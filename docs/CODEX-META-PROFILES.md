# Codex model routing

The local Codex configuration uses Meta Model API for coding, with Muse Spark
1.3 as the default. Named profiles make the other supported Meta text models
available. GPT remains available in dedicated review profiles, so it can be
used for cross-model review without taking the default coding route.

Use a profile in a terminal with `codex --profile PROFILE_NAME`. The configured
profiles are:

| Profile | Model | Use |
| --- | --- | --- |
| `meta-spark-1-3` | `muse-spark-1.3` | Default Meta coding model |
| `meta-spark-1-2` | `muse-spark-1.2` | Previous Spark release |
| `meta-spark-1-1` | `muse-spark-1.1` | Earlier Spark release |
| `meta-spark-1-3-contributor` | `muse-spark-1.3-contributor` | Spark 1.3 Contributor mode |
| `meta-spark-1-2-contributor` | `muse-spark-1.2-contributor` | Spark 1.2 Contributor mode |
| `meta-wonder-1-0` | `muse-wonder-1.0` | Muse Wonder preview |
| `gpt-review-luna` | `gpt-6-luna` | Cost-conscious first review |
| `gpt-review-sol` | `gpt-6.1-sol` | Final or difficult review |

The Meta provider uses the official Responses endpoint and retrieves the key
from the environment variable `DD_META_KEY` or the macOS Keychain through a
local helper. It does not store the key in Codex configuration. After installing
the config, restart Codex or start a new thread to use the default Meta model;
the current running thread cannot change its model retroactively.

Lesson content generation follows a separate route: Baseten Muse Spark Open
creates lesson drafts, Meta repairs them, and GPT reviews. Baseten's published
Muse Spark Open example uses Chat Completions, while Codex custom providers
currently use the Responses wire protocol, so Baseten is configured in the
Lesson Studio pipeline rather than as a direct Codex provider.
