export function shouldShowQualtricsButton(qualtricsEnabled: boolean, canRun: boolean): boolean {
  return qualtricsEnabled === true && canRun === true;
}
