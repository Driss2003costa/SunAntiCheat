package sunanticheat.client;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Informations client d'un joueur : premium/crack, marque client, mods, packs de ressources.
 */
public class ClientInfo {

    private String clientBrand;
    private Boolean premium; // null = inconnu, true = authentifié Mojang, false = serveur hors-ligne
    private final List<String> mods = new ArrayList<>();
    private final List<String> resourcePacks = new ArrayList<>();

    public String getClientBrand() {
        return clientBrand;
    }

    public void setClientBrand(String clientBrand) {
        this.clientBrand = clientBrand != null ? clientBrand : "vanilla";
    }

    /** true = compte authentifié Mojang (serveur online-mode), false = serveur hors-ligne (crack possible). */
    public Boolean getPremium() {
        return premium;
    }

    public void setPremium(Boolean premium) {
        this.premium = premium;
    }

    public List<String> getMods() {
        return Collections.unmodifiableList(mods);
    }

    public void setMods(List<String> mods) {
        this.mods.clear();
        if (mods != null) {
            this.mods.addAll(mods);
        }
    }

    public List<String> getResourcePacks() {
        return Collections.unmodifiableList(resourcePacks);
    }

    public void setResourcePacks(List<String> packs) {
        this.resourcePacks.clear();
        if (packs != null) {
            this.resourcePacks.addAll(packs);
        }
    }
}
