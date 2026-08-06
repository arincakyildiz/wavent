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
});
