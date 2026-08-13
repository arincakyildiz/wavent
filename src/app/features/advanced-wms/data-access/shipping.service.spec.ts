import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { isApiError } from '../../../core/api/api-error';
import { FaultInjectionService } from '../../../core/api/fault-injection.service';
import { db } from './mock-data';
import { ShippingService } from './shipping.service';

describe('ShippingService workflow', () => {
  it('refuses to load an unverified package', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ShippingService);
    TestBed.inject(FaultInjectionService).reset();
    const shipment = db.shipments.find((row) => row.status === 'staged' || row.status === 'loading' || row.status === 'exception');
    if (!shipment) return pending('no mutable shipment');
    const shipmentSnapshot = { ...shipment, packageCodes: [...shipment.packageCodes], loadedPackageCodes: [...shipment.loadedPackageCodes] };
    shipment.loadedPackageCodes = [];
    shipment.status = 'staged';
    const pkg = db.packages.find((row) => row.code === shipment.packageCodes[0]);
    if (!pkg) return pending('shipment has no package');
    const packageSnapshot = { ...pkg };
    pkg.contentVerified = false;
    pkg.status = 'sealed';
    let error: unknown;
    try {
      await firstValueFrom(service.loadNextPackage(shipment.id, shipment.version));
    } catch (value) {
      error = value;
    }
    expect(isApiError(error) && error.kind).toBe('validation');
    Object.assign(shipment, shipmentSnapshot);
    shipment.packageCodes = shipmentSnapshot.packageCodes;
    shipment.loadedPackageCodes = shipmentSnapshot.loadedPackageCodes;
    Object.assign(pkg, packageSnapshot);
  });

  it('assigns a door, loads verified packages in order and closes the shipment', async () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(ShippingService);
    TestBed.inject(FaultInjectionService).reset();
    const shipment = db.shipments.find((row) => row.status === 'staged' || row.status === 'loading' || row.status === 'exception');
    if (!shipment || !shipment.packageCodes.length) return pending('no mutable shipment with packages');
    const shipmentSnapshot = { ...shipment, packageCodes: [...shipment.packageCodes], loadedPackageCodes: [...shipment.loadedPackageCodes] };
    const packages = db.packages.filter((row) => shipment.packageCodes.includes(row.code));
    const packageSnapshots = packages.map((row) => ({ row, snapshot: { ...row } }));

    try {
      shipment.status = 'staged';
      shipment.loadedPackageCodes = [];
      shipment.progressPct = 0;
      for (const pkg of packages) {
        pkg.contentVerified = true;
        pkg.weightKg = pkg.expectedWeightKg;
        pkg.status = 'sealed';
      }

      let current = await firstValueFrom(service.assignDoor(shipment.id, shipment.version, 'd-09'));
      expect(current.door).toBe('D-09');
      for (const code of shipment.packageCodes) {
        current = await firstValueFrom(service.loadNextPackage(shipment.id, current.version));
        expect(current.loadedPackageCodes.at(-1)).toBe(code);
      }
      const closed = await firstValueFrom(service.close(shipment.id, current.version, 'Araç ve mühür kontrol edildi'));
      expect(closed.status).toBe('in-transit');
      expect(closed.progressPct).toBe(100);
      expect(packages.every((pkg) => pkg.status === 'shipped')).toBe(true);
    } finally {
      Object.assign(shipment, shipmentSnapshot);
      shipment.packageCodes = shipmentSnapshot.packageCodes;
      shipment.loadedPackageCodes = shipmentSnapshot.loadedPackageCodes;
      for (const { row, snapshot } of packageSnapshots) Object.assign(row, snapshot);
    }
  });
});
