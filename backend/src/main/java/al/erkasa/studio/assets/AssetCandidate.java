package al.erkasa.studio.assets;

import java.util.List;

/**
 * An asset proposed for a slot in a scene plan, with the score that ranked it and the reasons.
 *
 * @param matched human-readable reasons, e.g. {@code theme:money}, {@code tag:chart}, {@code word:growth}
 */
public record AssetCandidate(AssetSummary asset, int score, List<String> matched) {}
