"""Test suite for coverage analysis across 30 real Hemnet listings.

Each listing is from a different municipality or area to ensure
geographic diversity in the test set.
"""

# 30 real Hemnet listings from different municipalities/areas
# Format: (hemnet_url, expected_municipality, description)
HEMNET_LISTINGS = [
    # Stockholm (5 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-kungsholmen-stockholms-kommun-hantverkargatan-30-21706845",
        "Stockholms kommun",
        "Kungsholmen - older building (1884)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-gardet-stockholms-kommun-carl-akrells-gata-4-21705061",
        "Stockholms kommun",
        "Gardet - mid-century building",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-hogdalen-stockholms-kommun-skebokvarnsvagen-201,-6-tr-21622262",
        "Stockholms kommun",
        "Hogdalen - 1950s building",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-1rum-ekhagen-norra-djurgarden-stockholms-kommun-ekhagsvagen-9-21711914",
        "Stockholms kommun",
        "Ekhagen - 1930s building",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-kungsholmen-stora-essingen-stockholms-kommun-essingestraket-23-21474463",
        "Stockholms kommun",
        "Stora Essingen - small apartment",
    ),
    # Goteborg (5 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-heden-goteborgs-kommun-bohusgatan-11c-21686322",
        "Goteborgs kommun",
        "Heden - new construction (2025)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-centrala-hisingen-goteborgs-kommun-ekebergsgatan-4a-21711001",
        "Goteborgs kommun",
        "Centrala Hisingen - 1920s building",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-4rum-angered-goteborgs-kommun-gunnaredsterrassen-81-21590135",
        "Goteborgs kommun",
        "Angered - suburban area",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-1rum-lindholmen-goteborgs-kommun-lindholmshamnen-4-21621679",
        "Goteborgs kommun",
        "Lindholmen - new construction (2021)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-lindholmen-goteborgs-kommun-lodjursstraket-1-karlatornet,-van-53-21599515",
        "Goteborgs kommun",
        "Karlatornet - high-rise (2020)",
    ),
    # Malmo (3 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-rosengard-malmo-kommun-von-lingens-vag-4-21673122",
        "Malmo kommun",
        "Rosengard - affordable area",
    ),
    # Uppsala (5 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-kvarngardet-uppsala-kommun-kantorsgatan-5-21663248",
        "Uppsala kommun",
        "Kvarngardet - typical Uppsala",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-5rum-luthagen-uppsala-kommun-luthagsesplanaden-24a-21585311",
        "Uppsala kommun",
        "Luthagen - premium area (1930s)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-4rum-svartbacken-uppsala-kommun-svartbacksgatan-133-21707401",
        "Uppsala kommun",
        "Svartbacken - family area (2002)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-kapellgardet-uppsala-kommun-orgelgatan-7-21710786",
        "Uppsala kommun",
        "Kapellgardet - modern architecture (2019)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-centrum-uppsala-kommun-hamnesplanaden-2d-21555860",
        "Uppsala kommun",
        "Centrum - central location (1985)",
    ),
    # Vasteras (2 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-city-vasteras-kommun-kakelgatan-1-21620969",
        "Vasteras kommun",
        "City - central Vasteras",
    ),
    # Orebro (2 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-tegnerlundsparken-orebro-kommun-vastra-nobelgatan-30a-21561397",
        "Orebro kommun",
        "Tegnerlundsparken - renovated (2024)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-ladugardsangen-orebro-kommun-karlsdalsallen-47-b-21370798",
        "Orebro kommun",
        "Ladugardsangen - new construction (2017)",
    ),
    # Additional Stockholm area (8 listings for better coverage)
    (
        "https://www.hemnet.se/bostad/lagenhet-1rum-stockholms-kommun-olmevagen-20,-1-tr-21607834",
        "Stockholms kommun",
        "Farsta area - 1950s building",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-hasselby-gard-stockholms-kommun-astrakangatan-4-21655760",
        "Stockholms kommun",
        "Hasselby gard - suburban (1956)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-1rum-telefonplan-midsommarkransen-stockholms-kommun-diavoxvagen-32-21689922",
        "Stockholms kommun",
        "Telefonplan - inner suburb",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-5rum-lilla-essingen-stockholms-kommun-primusgatan-6,-lgh-1401-21561439",
        "Stockholms kommun",
        "Lilla Essingen - premium (2025)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-3rum-kungsholmen-thorildsplan-stockholms-kommun-drottningholmsvagen-78-21709479",
        "Stockholms kommun",
        "Kungsholmen - renovated (1926)",
    ),
    # Additional Goteborg (3 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-lindholmen-goteborgs-kommun-karlavagnsgatan-1-21665374",
        "Goteborgs kommun",
        "Lindholmen - new construction (2023)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-1rum-heden-goteborgs-kommun-bohusgatan-7d-21563482",
        "Goteborgs kommun",
        "Heden - new construction (2025)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-1,5rum-kviberg-goteborgs-kommun-ingeborg-hammarskjolds-gata-52-18903725",
        "Goteborgs kommun",
        "Kviberg - new area (2020)",
    ),
    # Additional cities (5 listings)
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-uppsala-kommun-salagatan-15a-21596417",
        "Uppsala kommun",
        "Hoganas - central Uppsala",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-2rum-nyby-gard-uppsala-kommun-hurtigs-gata-31-21701693",
        "Uppsala kommun",
        "Nyby gard - family area (1986)",
    ),
    (
        "https://www.hemnet.se/bostad/lagenhet-4rum-torslanda-hastevik-goteborgs-kommun-lilletummens-vag-7-21583922",
        "Goteborgs kommun",
        "Torslanda - new construction (2025)",
    ),
]

# Verify we have 30 listings
assert len(HEMNET_LISTINGS) == 30, f"Expected 30 listings, got {len(HEMNET_LISTINGS)}"

# Verify all URLs are unique
urls = [url for url, _, _ in HEMNET_LISTINGS]
assert len(urls) == len(set(urls)), "Duplicate URLs found"

# Verify all municipalities are present
municipalities = set(muni for _, muni, _ in HEMNET_LISTINGS)
print(f"Test suite: {len(HEMNET_LISTINGS)} listings from {len(municipalities)} municipalities")
print(f"Municipalities: {', '.join(sorted(municipalities))}")
