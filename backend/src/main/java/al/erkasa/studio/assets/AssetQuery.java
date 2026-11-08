package al.erkasa.studio.assets;

/**
 * Filters for listing assets. Every field is optional (null = no filter).
 *
 * @param q free text matched against id, name and tags (case-insensitive substring)
 */
public record AssetQuery(String category, String kind, String theme, String tag, String q, int limit, int offset) {

    public static final int MAX_LIMIT = 500;

    public AssetQuery {
        category = blankToNull(category);
        kind = blankToNull(kind);
        theme = blankToNull(theme);
        tag = blankToNull(tag);
        q = blankToNull(q);
        if (limit <= 0 || limit > MAX_LIMIT) {
            limit = limit <= 0 ? 100 : MAX_LIMIT;
        }
        offset = Math.max(0, offset);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
