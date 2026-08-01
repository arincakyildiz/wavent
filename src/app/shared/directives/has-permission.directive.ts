import {
  Directive,
  TemplateRef,
  ViewContainerRef,
  effect,
  inject,
  input,
} from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Permission } from '../../core/auth/permissions';

/**
 * Structural guard for action affordances:
 *
 *   <button *appHasPermission="'wave.release'">Yayınla</button>
 *
 * Removes the element from the DOM rather than hiding it with CSS, so an
 * unauthorised control cannot be revealed or triggered from the client.
 */
@Directive({
  selector: '[appHasPermission]',
  standalone: true,
})
export class HasPermissionDirective {
  private readonly template = inject(TemplateRef<unknown>);
  private readonly container = inject(ViewContainerRef);
  private readonly auth = inject(AuthService);

  readonly appHasPermission = input.required<Permission | Permission[]>();

  private rendered = false;

  constructor() {
    effect(() => {
      const required = this.appHasPermission();
      const list = Array.isArray(required) ? required : [required];
      const allowed = list.some((p) => this.auth.can(p));

      if (allowed && !this.rendered) {
        this.container.createEmbeddedView(this.template);
        this.rendered = true;
      } else if (!allowed && this.rendered) {
        this.container.clear();
        this.rendered = false;
      }
    });
  }
}
