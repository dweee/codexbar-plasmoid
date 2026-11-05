.pragma library

// Curated upstream/main ProviderDescriptor palettes.
var PALETTES = {
    "abacus": [
        "#814EE8",
        "#C64AF9",
        "#FFFFFF"
    ],
    "alibaba": [
        "#FF6A00",
        "#111111",
        "#FFFFFF"
    ],
    "alibabatokenplan": [
        "#FF6A00",
        "#0064C8",
        "#FFFFFF"
    ],
    "amp": [
        "#091C1E",
        "#DFDFC1",
        "#F34E3F"
    ],
    "antigravity": [
        "#4285F4",
        "#34A853",
        "#FBBC04"
    ],
    "augment": [
        "#1AA049",
        "#111111",
        "#FFF7ED"
    ],
    "azureopenai": [
        "#0078D4",
        "#50E6FF",
        "#FFFFFF"
    ],
    "bedrock": [
        "#01A88D",
        "#232F3E",
        "#FF9900"
    ],
    "claude": [
        "#D97757",
        "#F0EEE6",
        "#141413"
    ],
    "coderabbit": [
        "#FF5C35",
        "#FFA07A",
        "#1A1A24"
    ],
    "codebuff": [
        "#00FF95",
        "#FFFFFF",
        "#000000"
    ],
    "codex": [
        "#736BD4",
        "#97A9F7",
        "#CFD4F7"
    ],
    "commandcode": [
        "#000000",
        "#FFFFFF",
        "#8C4EDD"
    ],
    "copilot": [
        "#8534F3",
        "#F08A3A",
        "#C898FD"
    ],
    "cursor": [
        "#F54E00",
        "#1B1913",
        "#EDECEC"
    ],
    "deepseek": [
        "#4D6BFE",
        "#3982FF",
        "#020E36"
    ],
    "devin": [
        "#317CFF",
        "#000000",
        "#FFFFFF"
    ],
    "doubao": [
        "#0057FF",
        "#EFC5BA",
        "#493530"
    ],
    "factory": [
        "#EE6018",
        "#A0CA92",
        "#1D1A18"
    ],
    "gemini": [
        "#4285F4",
        "#A142F4",
        "#D96570"
    ],
    "grok": [
        "#000000",
        "#868686",
        "#FDFDFD"
    ],
    "groq": [
        "#F43E01",
        "#FFFFFF",
        "#97FCA7"
    ],
    "ibmbob": [
        "#0E61FA",
        "#A16EFB",
        "#001D6C"
    ],
    "jetbrains": [
        "#6B57FF",
        "#21D789",
        "#000000"
    ],
    "kilo": [
        "#FA483A",
        "#AC1D0E",
        "#121212"
    ],
    "kimi": [
        "#000000",
        "#4E6EF2",
        "#FFFFFF"
    ],
    "kiro": [
        "#9046FF",
        "#CAA9FF",
        "#2B2B2B"
    ],
    "longcat": [
        "#29E154",
        "#111111",
        "#FFFFFF"
    ],
    "mimo": [
        "#3D3834",
        "#736B68"
    ],
    "minimax": [
        "#181E25",
        "#86909C",
        "#F7F8FA"
    ],
    "mistral": [
        "#FF5229",
        "#FFAF01",
        "#FFE000"
    ],
    "moonshot": [
        "#121212",
        "#305140",
        "#9F9F9F"
    ],
    "muse": [
        "#0668E1",
        "#8B5CF6",
        "#FFFFFF"
    ],
    "notion": [
        "#337EA9",
        "#E16259",
        "#37352F"
    ],
    "ollama": [
        "#000000",
        "#FFFFFF"
    ],
    "openai": [
        "#000000",
        "#808080",
        "#FFFFFF"
    ],
    "opencode": [
        "#211E1E",
        "#CFCECD",
        "#FAB283"
    ],
    "opencodego": [
        "#211E1E",
        "#A3BE8C",
        "#CFCECD"
    ],
    "openrouter": [
        "#96A5B9",
        "#161616",
        "#FFFFFF"
    ],
    "pi": [
        "#F09082",
        "#4D9ABF",
        "#F1BE58"
    ],
    "qwencloud": [
        "#615CED",
        "#8B86F5",
        "#FFFFFF"
    ],
    "replicate": [
        "#000000",
        "#525252",
        "#FFFFFF"
    ],
    "stepfun": [
        "#000000",
        "#FFFFFF",
        "#858585"
    ],
    "typesafe": [
        "#111111",
        "#555555",
        "#FFFFFF"
    ],
    "vertexai": [
        "#4285F4",
        "#EA4335",
        "#FBBC04"
    ],
    "warp": [
        "#C7AEFF",
        "#1C1A26",
        "#FFFFFF"
    ],
    "wayfinder": [
        "#10A37F",
        "#BD6A13",
        "#0D0D0D"
    ],
    "windsurf": [
        "#000000",
        "#09B6A2",
        "#34E8BB"
    ],
    "zai": [
        "#126EF6",
        "#2D2D2D",
        "#DFE2E7"
    ],
    "zoommate": [
        "#0B5CFF",
        "#B4D0F8",
        "#00053D"
    ]
}
function forProvider(provider) { return PALETTES[provider] || PALETTES.codex }
