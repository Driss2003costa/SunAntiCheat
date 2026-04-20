package sunanticheat.dashboard.economy;

public record TransactionEntry(
        String id,
        long timestamp,
        String playerUuid,
        String playerName,
        String type,           // "BUY" | "SELL"
        String itemMaterial,
        String itemDisplayName,
        int quantity,
        double pricePerUnit,
        double totalPrice,
        String shopName,
        String result          // "SUCCESS" | ...
) {}
