package sunanticheat.dashboard.economy;

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
 * Écoute les transactions EconomyShopGUI+ et les persiste dans TransactionStore.
 */
public final class EconomyRecorder implements Listener {

    private final TransactionStore store;
    private final Logger logger;

    public EconomyRecorder(TransactionStore store, Logger logger) {
        this.store = store;
        this.logger = logger;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onTransaction(PostTransactionEvent event) {
        Transaction.Result result = event.getTransactionResult();
        if (result != Transaction.Result.SUCCESS && result != Transaction.Result.SUCCESS_COMMANDS_EXECUTED) return;

        String type = event.getTransactionType().name().startsWith("SELL") ? "SELL" : "BUY";
        int amount = event.getAmount();
        double totalPrice = event.getPrice();
        double pricePerUnit = amount > 0 ? totalPrice / amount : totalPrice;

        ShopItem shopItem = event.getShopItem();
        ItemStack itemStack = shopItem != null ? shopItem.getShopItem() : null;

        String material = itemStack != null ? itemStack.getType().name() : "UNKNOWN";
        String displayName = material;
        if (itemStack != null && itemStack.hasItemMeta()) {
            var meta = itemStack.getItemMeta();
            if (meta != null && meta.hasDisplayName()) {
                displayName = net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer
                        .plainText().serialize(meta.displayName());
            }
        }

        TransactionEntry entry = new TransactionEntry(
                UUID.randomUUID().toString(),
                System.currentTimeMillis(),
                event.getPlayer().getUniqueId().toString(),
                event.getPlayer().getName(),
                type,
                material,
                displayName,
                amount,
                round(pricePerUnit),
                round(totalPrice),
                "EconomyShopGUI",
                result.name()
        );

        store.add(entry);
    }

    private static double round(double v) { return Math.round(v * 100.0) / 100.0; }
}
