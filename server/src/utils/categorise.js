// server/src/utils/categorise.js
export function categoriseProduct(description) {
  const d = (description || '').toUpperCase();
  if (/PVC|DWV|STORMWATER|S\/W|SW BEND|SW TEE|EXPANDA|SWJ/.test(d)) return 'PVC/DWV/Stormwater';
  if (/PEX|AUSPEX|POLYETHYLENE|POLY|HDPE/.test(d)) return 'Pex/Poly';
  if (/COPPER|CU |KEMBLA/.test(d)) return 'Copper';
  if (/PHILMAC|3G FEM|3G EQUAL|3G MAL|COMPRESSION/.test(d)) return 'Compression Fittings';
  if (/SEPTIC|TANK|CARAT|GRAF/.test(d)) return 'Tanks & Septic';
  if (/CEMENT|PRIMER|SOLVENT/.test(d)) return 'Adhesives & Solvents';
  if (/CARTAGE|DELIVERY|FREIGHT|TRANSPORT|TRUCK|COURIER/.test(d)) return 'Cartage/Delivery';
  if (/TAP|VALVE|BALL VALVE|GATE|CHECK/.test(d)) return 'Valves & Taps';
  if (/TOILET|CISTERN|BASIN|SHOWER|BATH|WC/.test(d)) return 'Fixtures & Sanitaryware';
  if (/ARDENT|BRASS|NIPPLE|ELBOW|TEE|COUPLING|UNION|ADAPTOR|FITTING/.test(d)) return 'Brass/Metal Fittings';
  if (/CLIP|RATCHET|STRAP|SADDLE|ANCHOR|SCREW|FASTANOG/.test(d)) return 'Fixings & Clips';
  return 'Other';
}

export function classifyOrderType(orderNo) {
  const v = String(orderNo || '').trim();
  if (['WAREHOUSE', '2021', '0', 'nan', '0101', '2001'].includes(v)) return 'Stock/Warehouse';
  return 'Job Order';
}

export function isDeliveryItem(description) {
  return /CARTAGE|DELIVERY|FREIGHT|TRANSPORT|TRUCK|COURIER/i.test(description || '');
}
