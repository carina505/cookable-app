import { NextRequest, NextResponse } from "next/server";

const BASE = "https://www.themealdb.com/api/json/v1/1";

type MealSummary = { idMeal: string; strMeal: string; strMealThumb: string };
type MealDetail = Record<string, string | null>;

function extractIngredients(meal: MealDetail): string[] {
  const list: string[] = [];
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`];
    const meas = meal[`strMeasure${i}`];
    if (ing && ing.trim()) {
      list.push(meas?.trim() ? `${meas.trim()} ${ing.trim()}` : ing.trim());
    }
  }
  return list;
}

function scoreMatch(meal: MealDetail, userIngredients: string[]): number {
  let score = 0;
  for (let i = 1; i <= 20; i++) {
    const ing = meal[`strIngredient${i}`]?.toLowerCase() ?? "";
    if (ing && userIngredients.some((u) => ing.includes(u) || u.includes(ing))) {
      score++;
    }
  }
  return score;
}

async function fetchDetail(id: string): Promise<MealDetail | null> {
  const res = await fetch(`${BASE}/lookup.php?i=${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.meals?.[0] ?? null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("ingredients") ?? "";
  const category = searchParams.get("category") ?? "";
  const random = searchParams.get("random") === "true";

  // Random mode: fetch 8 random meals in parallel
  if (random) {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => fetch(`${BASE}/random.php`))
    );
    const meals = (
      await Promise.all(
        results
          .filter((r): r is PromiseFulfilledResult<Response> => r.status === "fulfilled")
          .map((r) => r.value.json())
      )
    )
      .flatMap((d) => d.meals ?? [])
      .map((meal: MealDetail) => formatMeal(meal, 0));

    return NextResponse.json({ recipes: meals });
  }

  const userIngredients = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (userIngredients.length === 0) {
    return NextResponse.json(
      { error: "Please provide at least one ingredient." },
      { status: 400 }
    );
  }

  // When a category is selected, intersect ingredient results with category results
  let candidates: MealSummary[] = [];

  const filterRes = await fetch(
    `${BASE}/filter.php?i=${encodeURIComponent(userIngredients[0])}`
  );
  if (!filterRes.ok) {
    return NextResponse.json(
      { error: "Failed to fetch recipes. Please try again." },
      { status: 502 }
    );
  }
  const filterData = await filterRes.json();
  candidates = filterData.meals ?? [];

  if (category) {
    const catRes = await fetch(
      `${BASE}/filter.php?c=${encodeURIComponent(category)}`
    );
    if (catRes.ok) {
      const catData = await catRes.json();
      const catIds = new Set((catData.meals ?? []).map((m: MealSummary) => m.idMeal));
      candidates = candidates.filter((m) => catIds.has(m.idMeal));
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ recipes: [], count: 0 });
  }

  // Fetch full details for first 16 candidates in parallel
  const details = await Promise.all(
    candidates.slice(0, 16).map((m) => fetchDetail(m.idMeal))
  );

  const recipes = details
    .filter((m): m is MealDetail => m !== null)
    .map((m) => ({ meal: m, score: scoreMatch(m, userIngredients) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ meal, score }) => formatMeal(meal, score));

  return NextResponse.json({ recipes, count: candidates.length });
}

function formatMeal(meal: MealDetail, matchScore: number) {
  return {
    id: meal.idMeal,
    label: meal.strMeal,
    image: meal.strMealThumb,
    category: meal.strCategory,
    area: meal.strArea,
    instructions: meal.strInstructions,
    youtube: meal.strYoutube,
    source: meal.strSource,
    tags: meal.strTags ? meal.strTags.split(",").map((t: string) => t.trim()).filter(Boolean) : [],
    ingredients: extractIngredients(meal),
    matchScore,
  };
}
