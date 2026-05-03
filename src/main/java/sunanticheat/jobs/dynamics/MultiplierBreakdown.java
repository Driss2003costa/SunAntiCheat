package sunanticheat.jobs.dynamics;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Décomposition d'un multiplicateur final appliqué à une action métier.
 * Permet d'afficher au joueur d'où viennent les bonus (« x1.5 saison + x2 pluie »).
 *
 * La valeur finale = produit de tous les facteurs (clamped à >= 0.1).
 */
public final class MultiplierBreakdown {

    private final Map<String, Double> factors = new LinkedHashMap<>();
    private double total = 1.0;

    /** Ajoute un facteur multiplicatif. Ignoré si {@code value == 1.0}. */
    public MultiplierBreakdown add(String label, double value) {
        if (value == 1.0 || Double.isNaN(value) || Double.isInfinite(value)) return this;
        factors.put(label, value);
        total *= value;
        return this;
    }

    public double total() {
        return Math.max(0.1, total);
    }

    public Map<String, Double> factors() { return factors; }

    public boolean hasBonus() { return !factors.isEmpty(); }

    /** Texte court pour debug ou notification : "Hiver x2.0 · Pluie x1.3". */
    public String summary() {
        if (factors.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        boolean first = true;
        for (var e : factors.entrySet()) {
            if (!first) sb.append(" · ");
            sb.append(e.getKey()).append(" x")
              .append(String.format("%.2f", e.getValue()).replaceAll("0+$","").replaceAll("\\.$",""));
            first = false;
        }
        return sb.toString();
    }
}
