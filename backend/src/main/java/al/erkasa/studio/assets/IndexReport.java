package al.erkasa.studio.assets;

import java.util.List;

/**
 * Outcome of one indexing run.
 *
 * @param indexed assets validated and upserted
 * @param unchanged subset of {@code indexed} whose content hash did not change
 * @param deactivated assets in the table that are no longer in the manifest
 * @param rejected assets whose asset.json was missing or failed the {@code asset} contract, with reasons
 */
public record IndexReport(String root, int indexed, int unchanged, int deactivated, List<Rejected> rejected, long millis) {

    public IndexReport {
        rejected = List.copyOf(rejected);
    }

    public record Rejected(String assetId, List<String> errors) {

        public Rejected {
            errors = List.copyOf(errors);
        }
    }
}
