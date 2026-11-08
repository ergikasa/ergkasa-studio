package al.erkasa.studio.assets;

/** The asset library on disk is missing or malformed (as opposed to a single invalid asset). */
public class AssetLibraryException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public AssetLibraryException(String message, Throwable cause) {
        super(message, cause);
    }
}
