package sunanticheat.dashboard.vip;

import java.util.ArrayList;
import java.util.List;

/**
 * Plan VIP proposé à l'achat (POJO sérialisé en JSON).
 * Tous les champs sont publics pour simplifier la sérialisation Gson.
 */
public class VipPlan {
    public String id;
    public String name;
    public String displayName;
    public String description;
    public String icon;
    public String color;
    public double priceEur;
    public int durationDays;
    public String rank;
    public List<String> perks = new ArrayList<>();
    public List<String> commandsOnActivate = new ArrayList<>();
    public List<String> commandsOnExpire = new ArrayList<>();
    public boolean enabled = true;
    public int order;
    public long createdAt;
}
