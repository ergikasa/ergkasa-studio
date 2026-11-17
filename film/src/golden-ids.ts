/**
 * Normalisation of kinetic-type ids, for comparing frames across the change from a global counter (kt1094) to
 * ids derived from the node (kt-s03_sh03-type-0).
 *
 * Every id that kineticType creates, where it is defined (id="…") and where it is referenced (url(#…),
 * href="#…"), is replaced by kt#n, numbered by first appearance in the frame. Nothing else is touched, so two
 * frames whose normalised text is equal differ at most in those ids and their references.
 */
const KT = /(id="|url\(#|href="#)(kt[A-Za-z0-9_-]*)/g;

export function normaliseKtIds(svg: string): string {
  const names = new Map<string, string>();
  return svg.replace(KT, (_, ctx: string, id: string) => {
    let n = names.get(id);
    if (n === undefined) {
      n = `kt#${names.size}`;
      names.set(id, n);
    }
    return `${ctx}${n}`;
  });
}
