package al.erkasa.studio.runs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Publishes the files of an accepted attempt (E1.6). A worker writes only under
 * {@code <run>/attempts/<stepId>-<fence>/} and reports every file it wants published with its sha256. The
 * orchestrator calls {@link #publish} inside the transaction that holds the step row lock and has checked that
 * the fence is current, so only that attempt can publish.
 *
 * <p>All files are verified first (location, name, hash); only then are they moved, each with an atomic
 * rename onto its public name: a reader sees the old file or the new one, never a partial one. Publishing the
 * same result again is idempotent: a file already moved is recognised by its hash at the public name.
 */
@Component
public class ArtifactPublisher {

    /** Path segments a published file may use (no dot-only segments, no separators, no control characters). */
    private static final Pattern SEGMENT = Pattern.compile("^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$");
    private static final Pattern SHA256 = Pattern.compile("^[a-f0-9]{64}$");

    private final RunStorage storage;
    private final ObjectMapper mapper = new ObjectMapper();

    public ArtifactPublisher(RunStorage storage) {
        this.storage = storage;
    }

    /** A result whose files cannot be published (a fault of that attempt: another attempt may succeed). */
    public static class PublishRefused extends Exception {

        private static final long serialVersionUID = 1L;

        public PublishRefused(String message) {
            super(message);
        }
    }

    /** The attempt folder of a fence, relative to the run folder. */
    public static String attemptDir(String stepId, long fence) {
        return "attempts/" + stepId + "-" + fence;
    }

    private record Item(JsonNode pointer, String relative, Path source, Path target, String sha256) {}

    /**
     * Moves the attempt's files to their public names and returns the outputs with public refs
     * ({@code file://<runId>/<relative>}). Nothing is moved unless every file passes.
     */
    public ArrayNode publish(String runId, String stepId, long fence, JsonNode outputs) throws PublishRefused, IOException {
        Path runDir = storage.dir(runId).orElseThrow(() -> new PublishRefused("invalid run id " + runId));
        Path attempt = runDir.resolve(attemptDir(stepId, fence)).normalize();
        String prefix = "file://" + runId + "/" + attemptDir(stepId, fence) + "/";
        if (!outputs.isArray() || outputs.isEmpty()) {
            throw new PublishRefused("no outputs to publish");
        }
        if (!Files.isDirectory(attempt, LinkOption.NOFOLLOW_LINKS)) {
            throw new PublishRefused("the attempt folder " + attemptDir(stepId, fence) + " does not exist");
        }
        Path realAttempt = attempt.toRealPath();
        Path realRun = runDir.toRealPath();

        List<Item> items = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode o : outputs) {
            String ref = o.path("ref").asText("");
            if (!ref.startsWith(prefix)) {
                throw new PublishRefused("output " + ref + " is outside the attempt folder " + prefix);
            }
            String relative = ref.substring(prefix.length());
            checkRelative(relative);
            if (!seen.add(relative)) {
                throw new PublishRefused("output " + relative + " is listed twice");
            }
            String sha = o.path("sha256").asText("");
            if (!SHA256.matcher(sha).matches()) {
                throw new PublishRefused("output " + relative + " has no sha256");
            }
            Path source = attempt.resolve(relative).normalize();
            Path target = runDir.resolve(relative).normalize();
            if (!source.startsWith(attempt) || !target.startsWith(runDir)) {
                throw new PublishRefused("output " + relative + " leaves its folder");
            }
            items.add(new Item(o, relative, source, target, sha));
        }

        // 1. verify everything; nothing is moved if one file fails
        for (Item it : items) {
            if (Files.exists(it.source(), LinkOption.NOFOLLOW_LINKS)) {
                if (!Files.isRegularFile(it.source(), LinkOption.NOFOLLOW_LINKS)) {
                    throw new PublishRefused("output " + it.relative() + " is not a regular file");
                }
                if (!it.source().toRealPath().startsWith(realAttempt)) {
                    throw new PublishRefused("output " + it.relative() + " resolves outside the attempt folder");
                }
                String actual = sha256(it.source());
                if (!actual.equals(it.sha256())) {
                    throw new PublishRefused("output " + it.relative() + " has sha256 " + actual + ", the result says " + it.sha256());
                }
            } else if (!(Files.isRegularFile(it.target(), LinkOption.NOFOLLOW_LINKS) && sha256(it.target()).equals(it.sha256()))) {
                // the source may only be missing because an earlier delivery of this result already moved it
                throw new PublishRefused("output " + it.relative() + " does not exist in the attempt folder");
            }
            Optional<Path> parent = existingAncestor(it.target().getParent());
            if (parent.isEmpty() || !parent.get().toRealPath().startsWith(realRun)) {
                throw new PublishRefused("output " + it.relative() + " would be written outside the run folder");
            }
            if (Files.isSymbolicLink(it.target())) {
                throw new PublishRefused("public name " + it.relative() + " is a symbolic link");
            }
        }

        // 2. publish: one atomic rename per file
        ArrayNode published = mapper.createArrayNode();
        for (Item it : items) {
            if (Files.exists(it.source(), LinkOption.NOFOLLOW_LINKS)) {
                Files.createDirectories(it.target().getParent());
                Files.move(it.source(), it.target(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            }
            ObjectNode p = ((ObjectNode) it.pointer().deepCopy());
            p.put("ref", "file://" + runId + "/" + it.relative());
            published.add(p);
        }
        return published;
    }

    private static Optional<Path> existingAncestor(Path dir) {
        Path p = dir;
        while (p != null && !Files.exists(p)) {
            p = p.getParent();
        }
        return Optional.ofNullable(p);
    }

    private static void checkRelative(String relative) throws PublishRefused {
        if (relative.isEmpty() || relative.length() > 300) {
            throw new PublishRefused("empty or too long output path");
        }
        String[] parts = relative.split("/", -1);
        for (String part : parts) {
            if (!SEGMENT.matcher(part).matches()) {
                throw new PublishRefused("invalid output path " + relative);
            }
        }
        if (parts[0].equals("attempts")) {
            throw new PublishRefused("output " + relative + " would be published into attempts/");
        }
    }

    static String sha256(Path file) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        try (InputStream in = new DigestInputStream(Files.newInputStream(file, LinkOption.NOFOLLOW_LINKS), digest)) {
            in.transferTo(java.io.OutputStream.nullOutputStream());
        }
        return HexFormat.of().formatHex(digest.digest());
    }
}
