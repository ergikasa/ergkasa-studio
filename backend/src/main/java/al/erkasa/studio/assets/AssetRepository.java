package al.erkasa.studio.assets;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** SQL access to the {@code asset} table (see V2__assets.sql). */
@Repository
public class AssetRepository {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final String SUMMARY_COLUMNS =
            "asset_id, version, name, category, kind, adapter, style, path, themes, tags";

    private final JdbcClient jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    public AssetRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** A validated asset ready to be written. JSON columns are passed as JSON text. */
    public record Row(
            String assetId,
            int version,
            String name,
            String category,
            String kind,
            String adapter,
            String style,
            String path,
            String themesJson,
            String tagsJson,
            String capabilitiesJson,
            String licenseJson,
            String metaJson,
            String contentHash) {}

    /** Content hashes of all rows, active or not. */
    public Map<String, String> hashes() {
        Map<String, String> out = new HashMap<>();
        jdbc.sql("select asset_id, content_hash from asset")
                .query(rs -> {
                    out.put(rs.getString(1), rs.getString(2));
                });
        return out;
    }

    /**
     * Upserts every row and deactivates rows that are not in {@code rows}, in one transaction, so readers
     * never see a half-indexed library. Returns how many rows were deactivated.
     */
    @Transactional
    public int replaceAll(Collection<Row> rows) {
        for (Row r : rows) {
            jdbc.sql("""
                    insert into asset (asset_id, version, name, category, kind, adapter, style, path,
                                       themes, tags, capabilities, license, meta, content_hash, active, indexed_at)
                    values (:assetId, :version, :name, :category, :kind, :adapter, :style, :path,
                            cast(:themes as jsonb), cast(:tags as jsonb), cast(:capabilities as jsonb),
                            cast(:license as jsonb), cast(:meta as jsonb), :hash, true, now())
                    on conflict (asset_id) do update set
                        version = excluded.version, name = excluded.name, category = excluded.category,
                        kind = excluded.kind, adapter = excluded.adapter, style = excluded.style,
                        path = excluded.path, themes = excluded.themes, tags = excluded.tags,
                        capabilities = excluded.capabilities, license = excluded.license, meta = excluded.meta,
                        content_hash = excluded.content_hash, active = true, indexed_at = now()
                    """)
                    .param("assetId", r.assetId())
                    .param("version", r.version())
                    .param("name", r.name())
                    .param("category", r.category())
                    .param("kind", r.kind())
                    .param("adapter", r.adapter())
                    .param("style", r.style())
                    .param("path", r.path())
                    .param("themes", r.themesJson())
                    .param("tags", r.tagsJson())
                    .param("capabilities", r.capabilitiesJson())
                    .param("license", r.licenseJson())
                    .param("meta", r.metaJson())
                    .param("hash", r.contentHash())
                    .update();
        }
        if (rows.isEmpty()) {
            return jdbc.sql("update asset set active = false where active").update();
        }
        List<String> ids = rows.stream().map(Row::assetId).toList();
        return jdbc.sql("update asset set active = false where active and asset_id not in (:ids)")
                .param("ids", ids)
                .update();
    }

    /** Lists active assets matching the query, ordered by category then id. */
    public List<AssetSummary> search(AssetQuery query) {
        Map<String, Object> params = new LinkedHashMap<>();
        String where = where(query, params);
        params.put("limit", query.limit());
        params.put("offset", query.offset());
        return jdbc.sql("select " + SUMMARY_COLUMNS + " from asset" + where
                        + " order by category, asset_id limit :limit offset :offset")
                .params(params)
                .query(this::summary)
                .list();
    }

    /** Number of active assets matching the query (ignores limit and offset). */
    public long count(AssetQuery query) {
        Map<String, Object> params = new LinkedHashMap<>();
        String where = where(query, params);
        return jdbc.sql("select count(*) from asset" + where).params(params).query(Long.class).single();
    }

    /** All active assets of a category and/or kind (null = any), for ranking in memory. */
    public List<AssetSummary> listActive(String category, String kind) {
        List<AssetSummary> out = new ArrayList<>();
        int offset = 0;
        while (true) {
            List<AssetSummary> page =
                    search(new AssetQuery(category, kind, null, null, null, AssetQuery.MAX_LIMIT, offset));
            out.addAll(page);
            if (page.size() < AssetQuery.MAX_LIMIT) {
                return out;
            }
            offset += page.size();
        }
    }

    public Optional<AssetSummary> findSummary(String assetId) {
        return jdbc.sql("select " + SUMMARY_COLUMNS + " from asset where asset_id = :id and active")
                .param("id", assetId)
                .query(this::summary)
                .optional();
    }

    /** The stored asset.json of an active asset, as JSON text. */
    public Optional<String> findMeta(String assetId) {
        return jdbc.sql("select meta::text from asset where asset_id = :id and active")
                .param("id", assetId)
                .query(String.class)
                .optional();
    }

    /** Active asset counts per category. */
    public Map<String, Long> countsByCategory() {
        Map<String, Long> out = new LinkedHashMap<>();
        jdbc.sql("select category, count(*) from asset where active group by category order by category")
                .query(rs -> {
                    out.put(rs.getString(1), rs.getLong(2));
                });
        return out;
    }

    private String where(AssetQuery query, Map<String, Object> params) {
        List<String> clauses = new ArrayList<>();
        clauses.add("active");
        if (query.category() != null) {
            clauses.add("category = :category");
            params.put("category", query.category());
        }
        if (query.kind() != null) {
            clauses.add("kind = :kind");
            params.put("kind", query.kind());
        }
        // jsonb containment (@>) instead of the ? operator, which clashes with JDBC placeholders.
        if (query.theme() != null) {
            clauses.add("themes @> cast(:theme as jsonb)");
            params.put("theme", jsonArray(query.theme()));
        }
        if (query.tag() != null) {
            clauses.add("tags @> cast(:tag as jsonb)");
            params.put("tag", jsonArray(query.tag()));
        }
        if (query.q() != null) {
            clauses.add("(asset_id ilike :q or name ilike :q or cast(tags as text) ilike :q)");
            params.put("q", "%" + escapeLike(query.q()) + "%");
        }
        return " where " + String.join(" and ", clauses);
    }

    private String jsonArray(String value) {
        try {
            return mapper.writeValueAsString(List.of(value));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }

    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private AssetSummary summary(ResultSet rs, int rowNum) throws SQLException {
        return new AssetSummary(
                rs.getString("asset_id"),
                rs.getInt("version"),
                rs.getString("name"),
                rs.getString("category"),
                rs.getString("kind"),
                rs.getString("adapter"),
                rs.getString("style"),
                rs.getString("path"),
                stringList(rs.getString("themes")),
                stringList(rs.getString("tags")));
    }

    private List<String> stringList(String json) {
        try {
            return json == null ? List.of() : List.copyOf(mapper.readValue(json, STRING_LIST));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("corrupt jsonb array in asset table: " + json, e);
        }
    }
}
