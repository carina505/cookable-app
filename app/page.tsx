"use client";

import { useState, useCallback, useRef } from "react";

type Recipe = {
  id: string;
  label: string;
  image: string;
  category: string;
  area: string;
  instructions: string;
  youtube: string;
  source: string;
  tags: string[];
  ingredients: string[];
  matchScore: number;
};

const CATEGORIES = [
  "Any", "Beef", "Chicken", "Seafood", "Vegetarian", "Pasta",
  "Dessert", "Side", "Starter", "Breakfast", "Lamb", "Pork",
];

export default function Home() {
  const [inputValue, setInputValue] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [category, setCategory] = useState("Any");
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultCount, setResultCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const addIngredient = useCallback(() => {
    const val = inputValue.trim().toLowerCase();
    if (!val || ingredients.includes(val)) {
      setInputValue("");
      return;
    }
    setIngredients((prev) => [...prev, val]);
    setInputValue("");
    inputRef.current?.focus();
  }, [inputValue, ingredients]);

  const removeIngredient = (ing: string) =>
    setIngredients((prev) => prev.filter((i) => i !== ing));

  const fetchRecipes = useCallback(
    async (random = false) => {
      if (!random && ingredients.length === 0) return;
      setLoading(true);
      setError("");
      setRecipes(null);

      const params = new URLSearchParams({ random: String(random) });
      if (ingredients.length > 0) params.set("ingredients", ingredients.join(","));
      if (category !== "Any") params.set("category", category);

      try {
        const res = await fetch(`/api/suggest?${params.toString()}`);
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Something went wrong. Please try again.");
        } else {
          setRecipes(data.recipes);
          setResultCount(data.count ?? 0);
        }
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    },
    [ingredients, category]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addIngredient();
    }
  };

  return (
    <main className="page">
      <header className="header">
        <h1>🍳 Cook<span>Able</span></h1>
        <p>Enter ingredients you have and discover what you can cook</p>
      </header>

      <section className="input-section">
        <div className="input-row">
          <input
            ref={inputRef}
            type="text"
            placeholder="Type an ingredient and press Enter  (e.g. chicken, pasta, garlic…)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="btn-add" onClick={addIngredient}>
            Add
          </button>
        </div>

        {ingredients.length > 0 ? (
          <div className="tags">
            {ingredients.map((ing) => (
              <span key={ing} className="tag">
                {ing}
                <button
                  onClick={() => removeIngredient(ing)}
                  aria-label={`Remove ${ing}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="empty-hint">
            No ingredients added yet — type above to get started
          </p>
        )}

        <div className="filters">
          <span className="filter-label">Category:</span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`filter-btn ${category === cat ? "active" : ""}`}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="search-bar">
          <button
            className="btn-search"
            onClick={() => fetchRecipes(false)}
            disabled={ingredients.length === 0 || loading}
          >
            {loading ? "Searching…" : "Find Recipes"}
          </button>
          <button
            className="btn-random"
            onClick={() => fetchRecipes(true)}
            disabled={loading}
            title="Get random meal suggestions"
          >
            🔀 Surprise me
          </button>
        </div>
      </section>

      {error && <div className="error">⚠️ {error}</div>}

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Finding delicious recipes…</p>
        </div>
      )}

      {!loading && recipes !== null && (
        <>
          <div className="results-header">
            <h2>Recipes found</h2>
            {resultCount > 0 && (
              <span className="results-count">
                {resultCount}+ matching meals
              </span>
            )}
          </div>

          {recipes.length === 0 ? (
            <div className="no-results">
              <p>No recipes found for these ingredients.</p>
              <p className="sub">Try different or fewer ingredients.</p>
            </div>
          ) : (
            <div className="grid">
              {recipes.map((recipe) => (
                <RecipeCard key={recipe.id} recipe={recipe} />
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function RecipeCard({ recipe }: { recipe: Recipe }) {
  const [expanded, setExpanded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const thumbUrl = recipe.image
    ? recipe.image.replace(/\/preview$/, "") + "/preview"
    : "";

  return (
    <article className="card">
      {thumbUrl && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="card-img"
          src={thumbUrl}
          alt={recipe.label}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="card-img-placeholder">🍽️</div>
      )}

      <div className="card-body">
        <h3 className="card-title">{recipe.label}</h3>

        <div className="card-meta">
          {recipe.category && <span>📂 {recipe.category}</span>}
          {recipe.area && <span>🌍 {recipe.area}</span>}
          {recipe.matchScore > 0 && (
            <span className="match-badge">
              ✓ {recipe.matchScore} match{recipe.matchScore !== 1 ? "es" : ""}
            </span>
          )}
        </div>

        {recipe.tags.length > 0 && (
          <div className="card-tags">
            {recipe.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="card-tag">{tag}</span>
            ))}
          </div>
        )}

        <p className="card-ingredients">
          {recipe.ingredients.slice(0, 5).join(" · ")}
          {recipe.ingredients.length > 5 ? ` · +${recipe.ingredients.length - 5} more` : ""}
        </p>

        {expanded && recipe.instructions && (
          <p className="card-instructions">{recipe.instructions.slice(0, 300)}…</p>
        )}

        <button
          className="btn-expand"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Hide instructions ↑" : "Preview instructions ↓"}
        </button>

        <div className="card-actions">
          {recipe.youtube && (
            <a
              href={recipe.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="card-link card-link-yt"
            >
              ▶ YouTube
            </a>
          )}
          {recipe.source && (
            <a
              href={recipe.source}
              target="_blank"
              rel="noopener noreferrer"
              className="card-link"
            >
              Full recipe →
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
