package sunanticheat.dashboard.shop;

import me.gypopo.economyshopgui.api.events.PostTransactionEvent;
import me.gypopo.economyshopgui.objects.ShopItem;
import me.gypopo.economyshopgui.util.Transaction;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.inventory.ItemStack;

import java.util.UUID;
import java.util.logging.Logger;

/**
 * Listener complémentaire à EconomyRecorder : enrichit les transactions avec le shop
 * correspondant (via getShop().getName()) et les enregistre dans le ShopStore.
 * N'interfère pas avec EconomyRecorder (chaque listener persiste dans son propre store).
 */
public final class ShopEconomyListener implements Listener {

    private final ShopStore store;
    private final Logger logger;

    public ShopEconomyListener(ShopStore store, Logger logger) {
        this.store = store;
        this.logger = logger;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTransaction(PostTransactionEvent event) {
        try {
            Transaction.Result result = event.getTransactionResult();
            if (result != Transaction.Result.SUCCESS
                    && result != Transaction.Result.SUCCESS_COMMANDS_EXECUTED) return;

            ShopItem shopItem = event.getShopItem();
            if (shopItem == null) return;

            // Retrouve le nom du shop — ESG expose shopItem.getShop().getName() selon version.
            String shopName = resolveShopName(shopItem);
            if (shopName == null) return;

            Shop ours = store.getShopByName(shopName);
            if (ours == null) return; // pas un shop géré par notre dashboard

            String type = event.getTransactionType().name().startsWith("SELL") ? "SELL" : "BUY";
            int amount = event.getAmount();
            double totalPrice = event.getPrice();
            double pricePer = amount > 0 ? totalPrice / amount : totalPrice;

            ItemStack stack = shopItem.getShopItem();
            String material = stack != null ? stack.getType().name() : "UNKNOWN";
            String displayName = material;
            if (stack != null && stack.hasItemMeta()) {
                var meta = stack.getItemMeta();
                if (meta != null && meta.hasDisplayName()) {
                    try {
                        displayName = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer
                                .plainText().serialize(meta.displayName());
                    } catch (Throwable ignored) {}
                }
            }

            // Tente de retrouver l'item correspondant par slot (null-safe)
            String itemId = null;
            try {
                Object slotObj = shopItem.getClass().getMethod("getSlot").invoke(shopItem);
                if (slotObj instanceof Number n) {
                    sunanticheat.dashboard.shop.ShopItem local = store.getItemAt(ours.id, n.intValue());
                    if (local != null) itemId = local.id;
                }
            } catch (Throwable ignored) {}

            ShopTransaction tx = new ShopTransaction();
            tx.id = UUID.randomUUID().toString();
            tx.shopId = ours.id;
            tx.shopName = ours.name;
            tx.itemId = itemId;
            tx.itemDisplayName = displayName;
            tx.itemMaterial = material;
            tx.playerUuid = event.getPlayer().getUniqueId().toString();
            tx.playerName = event.getPlayer().getName();
            tx.type = type;
            tx.amount = amount;
            tx.pricePer = round(pricePer);
            tx.totalPrice = round(totalPrice);
            tx.timestamp = System.currentTimeMillis();

            store.recordTransaction(tx);
        } catch (Throwable t) {
            logger.warning("[Dashboard/Shop] Erreur listener transaction: " + t.getMessage());
        }
    }

    /** Retrouve le nom du shop depuis un ShopItem ESG, par réflexion (compatible free + premium). */
    private static String resolveShopName(ShopItem shopItem) {
        try {
            Object shop = shopItem.getClass().getMethod("getShop").invoke(shopItem);
            if (shop != null) {
                Object name = shop.getClass().getMethod("getName").invoke(shop);
                if (name != null) return name.toString();
            }
        } catch (Throwable ignored) {}
        try {
            Object name = shopItem.getClass().getMethod("getShopName").invoke(shopItem);
            if (name != null) return name.toString();
        } catch (Throwable ignored) {}
        return null;
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
