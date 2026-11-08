package al.erkasa.studio.assets;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;

/** Read side of the asset registry: search, candidate ranking and safe file access. */
@Service
public class AssetService {

    /** Score weights. A theme match alone is weak; a tag match is the strongest signal. */
    static final int THEME_WEIGHT = 2;

    static final int TAG_WEIGHT = 3;
    static final int WORD_WEIGHT = 1;

    private final AssetRepository repository;
    private final AssetIndexer indexer;
    private final ObjectMapper mapper = new ObjectMapper();

    public AssetService(AssetRepository repository, AssetIndexer indexer) {
        this.repository = repository;
        this.indexer = indexer;
    }

    public record Page(long total, int limit, int offset, List<AssetSummary> items) {}

    public Page search(AssetQuery query) {
        return new Page(repository.count(query), query.limit(), query.offset(), repository.search(query));
    }

    /**
     * Ranks active assets for a slot. Filters by category/kind, then scores each asset: +2 if it carries the
     * theme, +3 per requested tag it has, +1 per word of {@code text} found in its id, name or tags. Assets
     * with score 0 are dropped unless no criteria were given. Ties break by asset id, so results are stable.
     */
    public List<AssetCandidate> candidates(
            String category, String kind, String theme, List<String> tags, String text, int limit) {
        Set<String> wantedTags = normalize(tags);
        Set<String> words = words(text);
        boolean anyCriteria = theme != null && !theme.isBlank() || !wantedTags.isEmpty() || !words.isEmpty();
        int max = limit <= 0 ? 10 : Math.min(limit, 100);

        List<AssetCandidate> out = new ArrayList<>();
        for (AssetSummary asset : repository.listActive(blankToNull(category), blankToNull(kind))) {
            int score = 0;
            List<String> matched = new ArrayList<>();
            if (theme != null && asset.themes().contains(theme.trim())) {
                score += THEME_WEIGHT;
                matched.add("theme:" + theme.trim());
            }
            for (String tag : wantedTags) {
                if (asset.tags().contains(tag)) {
                    score += TAG_WEIGHT;
                    matched.add("tag:" + tag);
                }
            }
            String haystack = (asset.assetId() + " " + asset.name() + " " + String.join(" ", asset.tags()))
                    .toLowerCase(Locale.ROOT);
            for (String word : words) {
                if (haystack.contains(word)) {
                    score += WORD_WEIGHT;
                    matched.add("word:" + word);
                }
            }
            if (score > 0 || !anyCriteria) {
                out.add(new AssetCandidate(asset, score, List.copyOf(matched)));
            }
        }
        out.sort(Comparator.comparingInt(AssetCandidate::score)
                .reversed()
                .thenComparing(c -> c.asset().assetId()));
        return out.size() > max ? List.copyOf(out.subList(0, max)) : List.copyOf(out);
    }

    public Optional<String> meta(String assetId) {
        return repository.findMeta(assetId);
    }

    /**
     * Resolves one file of an asset. Only files declared in the asset's {@code files} map are served, and the
     * resolved path must stay inside the asset's directory, so no request can read anything else on disk.
     */
    public Optional<Path> file(String assetId, String fileName) {
        Optional<AssetSummary> summary = repository.findSummary(assetId);
        Optional<String> metaJson = repository.findMeta(assetId);
        if (summary.isEmpty() || metaJson.isEmpty()) {
            return Optional.empty();
        }
        if (!declaredFiles(metaJson.get()).contains(fileName)) {
            return Optional.empty();
        }
        Path assetDir = indexer.root().resolve(summary.get().path()).normalize();
        Path file = assetDir.resolve(fileName).normalize();
        if (!assetDir.startsWith(indexer.root()) || !file.startsWith(assetDir) || !Files.isRegularFile(file)) {
            return Optional.empty();
        }
        return Optional.of(file);
    }

    private Set<String> declaredFiles(String metaJson) {
        Set<String> files = new LinkedHashSet<>();
        try {
            JsonNode meta = mapper.readTree(metaJson);
            meta.path("files").forEach(f -> files.add(f.asText()));
            meta.path("variants").forEach(f -> files.add(f.asText()));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("corrupt meta for asset", e);
        }
        return files;
    }

    private static Set<String> normalize(List<String> values) {
        Set<String> out = new LinkedHashSet<>();
        if (values != null) {
            for (String v : values) {
                if (v != null && !v.isBlank()) {
                    out.add(v.trim().toLowerCase(Locale.ROOT));
                }
            }
        }
        return out;
    }

    private static Set<String> words(String text) {
        Set<String> out = new LinkedHashSet<>();
        if (text != null) {
            for (String w : text.toLowerCase(Locale.ROOT).split("[^a-z0-9]+")) {
                if (w.length() >= 3) {
                    out.add(w);
                }
            }
        }
        return out;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
