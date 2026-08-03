import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

/**
 * §9 WarehouseTree — renders the warehouse → zone → aisle → bin hierarchy with
 * capacity and status rolled up at every level.
 *
 * The source rows are flat (`path` is "A/01/03"), so the tree is derived from the
 * path segments; parent capacity is the sum of the bins beneath it, which is what
 * makes a half-full zone visible without opening it.
 */

export interface WarehouseTreeNodeInput {
  id: string;
  path: string;
  warehouseCode: string;
  type: string;
  locationClass: string;
  status: string;
  maxWeightKg: number;
  usedWeightKg: number;
}

export interface TreeNode {
  key: string;
  label: string;
  /** 'warehouse' for the roots, otherwise the location type of the matching row. */
  kind: string;
  locationClass?: string;
  status?: string;
  maxWeightKg: number;
  usedWeightKg: number;
  capacityPct: number;
  binCount: number;
  depth: number;
  children: TreeNode[];
}

@Component({
  selector: 'app-warehouse-tree',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './warehouse-tree.component.html',
  styleUrl: './warehouse-tree.component.scss',
})
export class WarehouseTreeComponent {
  readonly locations = input.required<WarehouseTreeNodeInput[]>();
  readonly emptyMessage = input('Gösterilecek lokasyon bulunamadı.');

  /** Collapsed by key; roots start open so the screen is useful without clicking. */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set());

  readonly roots = computed(() => buildTree(this.locations()));

  /** Depth-first flattening, skipping anything under a collapsed node. */
  readonly visibleNodes = computed(() => {
    const out: TreeNode[] = [];
    const collapsed = this.collapsed();

    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        out.push(node);
        if (!collapsed.has(node.key)) walk(node.children);
      }
    };

    walk(this.roots());
    return out;
  });

  isCollapsed(node: TreeNode): boolean {
    return this.collapsed().has(node.key);
  }

  toggle(node: TreeNode): void {
    if (!node.children.length) return;
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(node.key)) next.delete(node.key);
      else next.add(node.key);
      return next;
    });
  }

  capacityTone(pct: number): string {
    if (pct >= 90) return 'tone-danger';
    if (pct >= 70) return 'tone-warning';
    return 'tone-success';
  }

  statusTone(status?: string): string {
    switch (status) {
      case 'blocked':
        return 'tone-danger';
      case 'full':
        return 'tone-warning';
      case 'inactive':
        return 'tone-neutral';
      default:
        return 'tone-success';
    }
  }
}

/* ------------------------------------------------------------------ *
 * Tree building
 * ------------------------------------------------------------------ */

interface MutableNode extends Omit<TreeNode, 'children' | 'capacityPct'> {
  children: Map<string, MutableNode>;
}

function makeNode(key: string, label: string, kind: string, depth: number): MutableNode {
  return {
    key,
    label,
    kind,
    maxWeightKg: 0,
    usedWeightKg: 0,
    binCount: 0,
    depth,
    children: new Map(),
  };
}

function buildTree(rows: WarehouseTreeNodeInput[]): TreeNode[] {
  const roots = new Map<string, MutableNode>();

  for (const row of rows) {
    const warehouse =
      roots.get(row.warehouseCode) ??
      makeNode(row.warehouseCode, row.warehouseCode, 'warehouse', 0);
    roots.set(row.warehouseCode, warehouse);

    const segments = row.path.split('/').filter(Boolean);
    let parent = warehouse;
    let key = row.warehouseCode;

    segments.forEach((segment, index) => {
      key = `${key}/${segment}`;
      const isLeaf = index === segments.length - 1;

      const existing =
        parent.children.get(segment) ??
        makeNode(key, segment, isLeaf ? row.type : 'group', index + 1);
      parent.children.set(segment, existing);

      // Only the row's own node carries its class/status; ancestors stay aggregate.
      if (isLeaf) {
        existing.kind = row.type;
        existing.locationClass = row.locationClass;
        existing.status = row.status;
      }

      parent = existing;
    });

    // Roll the leaf's capacity up through every ancestor, including the warehouse.
    if (row.type === 'bin') {
      let node: MutableNode | undefined = warehouse;
      const chain: MutableNode[] = [warehouse];
      for (const segment of segments) {
        node = node?.children.get(segment);
        if (node) chain.push(node);
      }
      for (const entry of chain) {
        entry.maxWeightKg += row.maxWeightKg;
        entry.usedWeightKg += row.usedWeightKg;
        entry.binCount += 1;
      }
    }
  }

  return [...roots.values()]
    .sort((a, b) => a.label.localeCompare(b.label))
    .map(finalise);
}

function finalise(node: MutableNode): TreeNode {
  return {
    key: node.key,
    label: node.label,
    kind: node.kind,
    locationClass: node.locationClass,
    status: node.status,
    maxWeightKg: node.maxWeightKg,
    usedWeightKg: node.usedWeightKg,
    capacityPct: node.maxWeightKg
      ? Math.round((node.usedWeightKg / node.maxWeightKg) * 100)
      : 0,
    binCount: node.binCount,
    depth: node.depth,
    children: [...node.children.values()]
      .sort((a, b) => a.label.localeCompare(b.label))
      .map(finalise),
  };
}
