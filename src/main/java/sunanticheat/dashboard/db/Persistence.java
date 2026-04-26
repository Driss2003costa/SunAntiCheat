package sunanticheat.dashboard.db;

import java.io.File;

/**
 * Helper utilisé par les Stores existants pour migrer leur persistance
 * fichier .json → DB (table `kv_blobs`) sans réécriture lourde.
 *
 * Chaque store déclare une instance, lui passe son scope unique + le
 * fichier legacy à migrer une seule fois. Ensuite :
 *   - read() retourne le JSON courant (DB en priorité, legacy file en fallback
 *     avec import auto)
 *   - write(json) écrit en DB
 */
public final class Persistence {

    private final BlobStorage blobs;
    private final String scope;
    private final File legacyFile;

    public Persistence(BlobStorage blobs, String scope, File legacyFile) {
        this.blobs = blobs;
        this.scope = scope;
        this.legacyFile = legacyFile;
    }

    /** Lit le contenu (DB en priorité ; sinon migration auto depuis le legacyFile). */
    public String read() {
        return blobs.loadOrMigrate(scope, legacyFile);
    }

    public void write(String json) { blobs.write(scope, json); }

    public boolean exists() { return blobs.exists(scope); }

    public String scope() { return scope; }
}
