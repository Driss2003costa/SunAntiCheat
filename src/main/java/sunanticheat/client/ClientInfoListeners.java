package sunanticheat.client;

import org.bukkit.entity.Player;

import java.lang.invoke.MethodHandle;
import java.lang.invoke.MethodHandles;
import java.lang.invoke.MethodType;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.messaging.PluginMessageListener;
import org.jetbrains.annotations.NotNull;

import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Met à jour ClientInfoTracker : à la connexion (marque client, premium), et à la réception de plugin messages (mods, packs).
 */
public class ClientInfoListeners implements Listener, PluginMessageListener {

    public static final String CHANNEL_CLIENT = "sunguard:client";

    private final ClientInfoTracker tracker;

    public ClientInfoListeners(ClientInfoTracker tracker) {
        this.tracker = tracker;
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Player player = event.getPlayer();
        ClientInfo info = tracker.getOrCreate(player.getUniqueId());
        info.setPremium(player.getServer().getOnlineMode());
        info.setClientBrand(getClientBrand(player));
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        tracker.remove(event.getPlayer().getUniqueId());
    }

    @Override
    public void onPluginMessageReceived(@NotNull String channel, @NotNull Player player, byte[] message) {
        if (!CHANNEL_CLIENT.equals(channel) || message == null || message.length == 0) {
            return;
        }
        try {
            DataInputStream in = new DataInputStream(new ByteArrayInputStream(message));
            int modCount = in.readShort() & 0xFFFF;
            List<String> mods = new ArrayList<>();
            for (int i = 0; i < modCount && in.available() > 0; i++) {
                mods.add(in.readUTF());
            }
            int packCount = in.readShort() & 0xFFFF;
            List<String> packs = new ArrayList<>();
            for (int i = 0; i < packCount && in.available() > 0; i++) {
                packs.add(in.readUTF());
            }
            ClientInfo info = tracker.getOrCreate(player.getUniqueId());
            info.setMods(mods);
            info.setResourcePacks(packs);
        } catch (IOException ignored) {
            // Format invalide, ignorer
        }
    }

    /** Récupère la marque client (Paper: getClientBrandName). Retourne "vanilla" si indisponible. */
    private static String getClientBrand(Player player) {
        try {
            MethodHandle mh = MethodHandles.publicLookup().findVirtual(Player.class, "getClientBrandName", MethodType.methodType(String.class));
            String brand = (String) mh.invoke(player);
            return brand != null && !brand.isEmpty() ? brand : "vanilla";
        } catch (Throwable ignored) {
            return "vanilla";
        }
    }
}
