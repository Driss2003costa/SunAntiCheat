package sunanticheat.blocklog;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.World;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Collectors;

/**
 * Stockage robuste des logs par bloc : limite par bloc, limite globale, persistance YAML.
 */
public class BlockLogStore {

    private static String keyOf(String world, int x, int y, int z) {
        return world + ";" + x + ";" + y + ";" + z;
    }

    public static String keyOf(Block block) {
        if (block == null || block.getWorld() == null) return null;
        return keyOf(block.getWorld().getName(), block.getX(), block.getY(), block.getZ());
    }

    private final File file;
    private final int maxEntriesPerBlock;
    private final int maxBlocks;
    private final Map<String, List<BlockLogEntry>> byBlock = new ConcurrentHashMap<>();
    private final LinkedList<String> accessOrder = new LinkedList<>();
    private final int maxAccessOrder;

    public BlockLogStore(JavaPlugin plugin, int maxEntriesPerBlock, int maxBlocks) {
        this.file = new File(plugin.getDataFolder(), "block-log.yml");
        this.maxEntriesPerBlock = Math.max(10, Math.min(500, maxEntriesPerBlock));
        this.maxBlocks = Math.max(1000, Math.min(500_000, maxBlocks));
        this.maxAccessOrder = this.maxBlocks;
        load();
    }

    private static final int MAX_ENTRIES_PER_PLAYER = 2000;
    private final Map<UUID, List<BlockLogRecord>> byPlayer = new ConcurrentHashMap<>();

    public static final class BlockLogRecord {
        public final String blockKey;
        public final BlockLogEntry entry;

        public BlockLogRecord(String blockKey, BlockLogEntry entry) {
            this.blockKey = blockKey;
            this.entry = entry;
        }
    }

    public void add(String blockKey, BlockLogEntry entry) {
        if (blockKey == null || entry == null) return;
        byBlock.compute(blockKey, (k, list) -> {
            List<BlockLogEntry> l = list != null ? list : new CopyOnWriteArrayList<>();
            l.add(entry);
            if (l.size() > maxEntriesPerBlock) {
                l = new CopyOnWriteArrayList<>(l.subList(l.size() - maxEntriesPerBlock, l.size()));
            }
            return l;
        });
        if (entry.getPlayerUuid() != null) {
            byPlayer.compute(entry.getPlayerUuid(), (uuid, list) -> {
                List<BlockLogRecord> r = list != null ? list : new CopyOnWriteArrayList<>();
                r.add(0, new BlockLogRecord(blockKey, entry));
                while (r.size() > MAX_ENTRIES_PER_PLAYER) r.remove(r.size() - 1);
                return r;
            });
        }
        touchAccess(blockKey);
    }

    public void add(Block block, BlockLogEntry.Type type, String playerName, UUID playerUuid) {
        add(block, type, playerName, playerUuid, type == BlockLogEntry.Type.BREAK ? block.getBlockData().getAsString() : null);
    }

    public void add(Block block, BlockLogEntry.Type type, String playerName, UUID playerUuid, String serializedBlockState) {
        String k = keyOf(block);
        if (k != null) {
            add(k, new BlockLogEntry(type, playerName, playerUuid, System.currentTimeMillis(), serializedBlockState));
        }
    }

    private void touchAccess(String blockKey) {
        synchronized (accessOrder) {
            accessOrder.remove(blockKey);
            accessOrder.addLast(blockKey);
            while (accessOrder.size() > maxAccessOrder && byBlock.size() > maxBlocks) {
                String oldest = accessOrder.pollFirst();
                if (oldest != null) byBlock.remove(oldest);
            }
        }
    }

    /** Liste des entrées pour ce bloc, plus récentes en premier. */
    public List<BlockLogEntry> getEntries(String blockKey) {
        if (blockKey == null) return Collections.emptyList();
        List<BlockLogEntry> list = byBlock.get(blockKey);
        if (list == null) return Collections.emptyList();
        List<BlockLogEntry> copy = new ArrayList<>(list);
        copy.sort((a, b) -> Long.compare(b.getTimestamp(), a.getTimestamp()));
        return copy;
    }

    public List<BlockLogEntry> getEntries(Block block) {
        return getEntries(keyOf(block));
    }

    /** Entrées pour rollback : joueur, monde, zone (rayon), depuis timestamp. Plus récentes en premier. */
    public List<BlockLogRecord> getEntriesForRollback(UUID playerUuid, String worldName, int centerX, int centerY, int centerZ, int radius, long since) {
        List<BlockLogRecord> list = byPlayer.get(playerUuid);
        if (list == null) return Collections.emptyList();
        return list.stream()
                .filter(r -> r.entry.getTimestamp() >= since)
                .filter(r -> {
                    int[] xyz = parseBlockKey(r.blockKey);
                    if (xyz == null) return false;
                    if (worldName != null && !worldName.equals(parseWorldFromKey(r.blockKey))) return false;
                    if (radius > 0) {
                        long dx = xyz[0] - centerX, dy = xyz[1] - centerY, dz = xyz[2] - centerZ;
                        if (dx * dx + dy * dy + dz * dz > (long) radius * radius) return false;
                    }
                    return true;
                })
                .sorted((a, b) -> Long.compare(b.entry.getTimestamp(), a.entry.getTimestamp()))
                .toList();
    }

    private static String parseWorldFromKey(String key) {
        if (key == null) return null;
        int i = key.indexOf(';');
        return i < 0 ? key : key.substring(0, i);
    }

    private static int[] parseBlockKey(String key) {
        if (key == null) return null;
        String[] parts = key.split(";");
        if (parts.length != 4) return null;
        try {
            return new int[]{Integer.parseInt(parts[1]), Integer.parseInt(parts[2]), Integer.parseInt(parts[3])};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Retire du stockage les entrées listées (mêmes références que dans byBlock / byPlayer). */
    void removeRecords(List<BlockLogRecord> records) {
        if (records == null || records.isEmpty()) return;
        for (BlockLogRecord r : records) {
            List<BlockLogEntry> blockList = byBlock.get(r.blockKey);
            if (blockList != null) {
                blockList.remove(r.entry);
                if (blockList.isEmpty()) {
                    byBlock.remove(r.blockKey);
                    synchronized (accessOrder) {
                        accessOrder.remove(r.blockKey);
                    }
                }
            }
            UUID u = r.entry.getPlayerUuid();
            if (u != null) {
                List<BlockLogRecord> playerList = byPlayer.get(u);
                if (playerList != null) {
                    playerList.remove(r);
                    if (playerList.isEmpty()) {
                        byPlayer.remove(u);
                    }
                }
            }
        }
    }

    /** Applique le rollback dans le monde donné. Retourne le nombre d'actions annulées. Retire du log les entrées effectivement annulées. */
    public int rollback(World world, List<BlockLogRecord> records) {
        if (world == null || records == null) return 0;
        int count = 0;
        List<BlockLogRecord> applied = new ArrayList<>();
        for (BlockLogRecord r : records) {
            int[] xyz = parseBlockKey(r.blockKey);
            if (xyz == null) continue;
            Block block = world.getBlockAt(xyz[0], xyz[1], xyz[2]);
            BlockLogEntry e = r.entry;
            if (e.getType() == BlockLogEntry.Type.BREAK && e.getSerializedBlockState() != null && !e.getSerializedBlockState().isEmpty()) {
                try {
                    BlockData data = Bukkit.createBlockData(e.getSerializedBlockState());
                    block.setBlockData(data);
                    count++;
                    applied.add(r);
                } catch (Exception ignored) {}
            } else if (e.getType() == BlockLogEntry.Type.PLACE) {
                block.setType(Material.AIR);
                count++;
                applied.add(r);
            }
        }
        removeRecords(applied);
        return count;
    }

    public void save() {
        YamlConfiguration cfg = new YamlConfiguration();
        for (Map.Entry<String, List<BlockLogEntry>> e : byBlock.entrySet()) {
            String k = e.getKey();
            List<?> list = e.getValue().stream()
                    .map(entry -> {
                        Map<String, Object> m = new LinkedHashMap<>();
                        m.put("type", entry.getType().name());
                        m.put("player", entry.getPlayerName());
                        m.put("uuid", entry.getPlayerUuid() != null ? entry.getPlayerUuid().toString() : "");
                        m.put("time", entry.getTimestamp());
                        if (entry.getSerializedBlockState() != null) m.put("blockState", entry.getSerializedBlockState());
                        return m;
                    })
                    .collect(Collectors.toList());
            cfg.set("blocks." + k.replace(";", "|"), list);
        }
        try {
            cfg.save(file);
        } catch (IOException ignored) {
        }
    }

    @SuppressWarnings("unchecked")
    public void load() {
        byBlock.clear();
        byPlayer.clear();
        synchronized (accessOrder) { accessOrder.clear(); }
        if (!file.exists()) return;
        YamlConfiguration cfg = YamlConfiguration.loadConfiguration(file);
        org.bukkit.configuration.ConfigurationSection blocks = cfg.getConfigurationSection("blocks");
        if (blocks == null) return;
        int loaded = 0;
        for (String key : blocks.getKeys(false)) {
            if (loaded >= maxBlocks) break;
            String blockKey = key.replace("|", ";");
            List<?> list = blocks.getList(key);
            if (list == null) continue;
            List<BlockLogEntry> entries = new CopyOnWriteArrayList<>();
            for (int i = Math.max(0, list.size() - maxEntriesPerBlock); i < list.size(); i++) {
                Object o = list.get(i);
                if (!(o instanceof Map)) continue;
                Map<String, Object> m = (Map<String, Object>) o;
                String typeStr = String.valueOf(m.get("type"));
                BlockLogEntry.Type type;
                try {
                    type = BlockLogEntry.Type.valueOf(typeStr);
                } catch (Exception ex) {
                    continue;
                }
                String player = String.valueOf(m.get("player"));
                UUID uuid = null;
                try {
                    String u = String.valueOf(m.get("uuid"));
                    if (u != null && !u.isEmpty()) uuid = UUID.fromString(u);
                } catch (Exception ignored) {
                }
                long time = ((Number) m.getOrDefault("time", 0L)).longValue();
                String blockState = m.containsKey("blockState") ? String.valueOf(m.get("blockState")) : null;
                entries.add(new BlockLogEntry(type, player, uuid, time, (blockState == null || blockState.isEmpty()) ? null : blockState));
            }
            if (!entries.isEmpty()) {
                byBlock.put(blockKey, entries);
                accessOrder.addLast(blockKey);
                for (BlockLogEntry ent : entries) {
                    if (ent.getPlayerUuid() != null) {
                        byPlayer.compute(ent.getPlayerUuid(), (u, existing) -> {
                            List<BlockLogRecord> r = existing != null ? existing : new CopyOnWriteArrayList<>();
                            r.add(new BlockLogRecord(blockKey, ent));
                            return r;
                        });
                    }
                }
                loaded++;
            }
        }
    }
}
