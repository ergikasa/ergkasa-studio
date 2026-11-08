package al.erkasa.studio.assets;

import java.util.List;

/** One row of the asset registry, as returned by list and search endpoints. */
public record AssetSummary(
        String assetId,
        int version,
        String name,
        String category,
        String kind,
        String adapter,
        String style,
        String path,
        List<String> themes,
        List<String> tags) {}
