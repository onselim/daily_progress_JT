/** Overall project completion = Design + Construction + Supply, weighted per the project's coefficient table. */
export const OVERALL_WEIGHTS = {
  design: 0.05,
  construction: 0.375,
  supply: 0.575,
};

export function computeOverallPercent(designPercent: number, constructionPercent: number, supplyPercent: number): number {
  return (
    designPercent * OVERALL_WEIGHTS.design +
    constructionPercent * OVERALL_WEIGHTS.construction +
    supplyPercent * OVERALL_WEIGHTS.supply
  );
}
