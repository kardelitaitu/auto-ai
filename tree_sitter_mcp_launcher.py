"""Local launcher for the tree-sitter MCP server.

This wrapper patches the installed server's language registry so C# file
extensions resolve to the language pack's actual `csharp` identifier.
"""

from mcp_server_tree_sitter.language.registry import LanguageRegistry


def _patch_language_registry() -> None:
    # The bundled language pack exposes `csharp`, while the server maps `.cs`
    # to `c_sharp`. Normalize that mapping for every registry instance.
    original_init = LanguageRegistry.__init__

    def patched_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        self._language_map["cs"] = "csharp"

    LanguageRegistry.__init__ = patched_init


def main() -> None:
    _patch_language_registry()

    from mcp_server_tree_sitter.server import main as server_main

    server_main()


if __name__ == "__main__":
    main()
