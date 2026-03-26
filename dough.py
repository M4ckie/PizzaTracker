import math


# Thickness select values from doughguy.co
THICKNESS_VALUES = {
    "thin": 1.8,
    "regular": 2.11,
    "thick": 2.75,
}

# Base constants from doughguy.co source
BASE_PIZZA_SIZE = 16
BASE_QUANTITY = 6
BASE_THICKNESS = 2.11
BASE_FLOUR_REGULAR = 1509.797685 * (480 / 425)
BASE_FLOUR_GF = 333 * 6  # 333g per pizza x 6 = 1998g
DOUGH_FACTOR = 2550 / 1509.797685


def calculate(size_inches, count, thickness, gluten_free):
    thickness_key = thickness.lower()
    if thickness_key not in THICKNESS_VALUES:
        raise ValueError(f"Invalid thickness: {thickness}. Must be one of {list(THICKNESS_VALUES.keys())}")

    thickness_val = THICKNESS_VALUES[thickness_key]

    size_scale = (size_inches / BASE_PIZZA_SIZE) ** 2
    quantity_scale = count / BASE_QUANTITY
    thickness_scale = thickness_val / BASE_THICKNESS

    base_flour = BASE_FLOUR_GF if gluten_free else BASE_FLOUR_REGULAR
    flour = base_flour * size_scale * quantity_scale * thickness_scale

    water_pct = 0.80 if gluten_free else 0.62
    water = round(flour * water_pct)
    yeast = flour * 0.004
    salt = round(flour * 0.025)
    sugar = round(flour * 0.02)
    olive_oil = round(flour * 0.033)

    total_dough = flour * DOUGH_FACTOR
    ball_weight = round(total_dough / count)

    flour_type = "Gluten-Free Flour" if gluten_free else "Bread Flour"

    return {
        "flour": round(flour),
        "water": water,
        "yeast": round(yeast, 1),
        "salt": salt,
        "sugar": sugar,
        "olive_oil": olive_oil,
        "ball_weight": ball_weight,
        "flour_type": flour_type,
    }


if __name__ == "__main__":
    result = calculate(size_inches=16, count=6, thickness="regular", gluten_free=False)
    print("Sample calculation: 16\" regular pizza x6")
    print(f"  Flour ({result['flour_type']}): {result['flour']}g")
    print(f"  Water:      {result['water']}g")
    print(f"  Yeast:      {result['yeast']}g")
    print(f"  Salt:       {result['salt']}g")
    print(f"  Sugar:      {result['sugar']}g")
    print(f"  Olive Oil:  {result['olive_oil']}g")
    print(f"  Ball weight: {result['ball_weight']}g each")

    print()
    gf = calculate(size_inches=16, count=6, thickness="regular", gluten_free=True)
    print("Sample calculation: 16\" regular GF pizza x6")
    print(f"  Flour ({gf['flour_type']}): {gf['flour']}g")
    print(f"  Water:      {gf['water']}g")
    print(f"  Yeast:      {gf['yeast']}g")
    print(f"  Salt:       {gf['salt']}g")
    print(f"  Sugar:      {gf['sugar']}g")
    print(f"  Olive Oil:  {gf['olive_oil']}g")
    print(f"  Ball weight: {gf['ball_weight']}g each")
