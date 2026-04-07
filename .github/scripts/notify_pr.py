"""Send an Adaptive Card to Teams when a PR is created."""

import asyncio
import os
import sys

from microsoft_teams.apps import App
from microsoft_teams.cards import (
    ActionSet,
    AdaptiveCard,
    Column,
    ColumnSet,
    Container,
    Fact,
    FactSet,
    OpenUrlAction,
    TextBlock,
)


def build_pr_card() -> AdaptiveCard:
    title = os.environ["PR_TITLE"]
    number = os.environ["PR_NUMBER"]
    author = os.environ["PR_AUTHOR"]
    url = os.environ["PR_URL"]
    repo = os.environ["PR_REPO"]
    body = os.environ.get("PR_BODY", "") or ""
    labels = os.environ.get("PR_LABELS", "") or ""

    # Replace markdown headers with bold text for the card
    import re
    clean = re.sub(r"^#{1,6}\s+(.+)$", r"**\1**", body, flags=re.MULTILINE)
    summary = clean[:200] + "..." if len(clean) > 200 else clean

    facts = [
        Fact(title="Author", value=f"@{author}"),
    ]
    if labels:
        facts.append(Fact(title="Labels", value=labels))

    return AdaptiveCard(
        version="1.5",
        body=[
            TextBlock(
                text=f"{repo}#{number}: {title}",
                size="Medium",
                weight="Bolder",
                wrap=True,
            ),
            ColumnSet(
                columns=[
                    Column(
                        width="auto",
                        items=[
                            TextBlock(
                                text="NEW PR",
                                weight="Bolder",
                                is_subtle=True,
                                size="Small",
                                color="Good",
                            )
                        ],
                    ),
                    Column(
                        width="stretch",
                        items=[
                            TextBlock(
                                text=f"by @{author}",
                                is_subtle=True,
                                size="Small",
                                horizontal_alignment="Right",
                            )
                        ],
                    ),
                ]
            ),
            *(
                [Container(items=[TextBlock(text=summary, wrap=True)])]
                if summary
                else []
            ),
            FactSet(facts=facts),
            ActionSet(
                actions=[OpenUrlAction(title="View Pull Request", url=url)]
            ),
        ],
    )


async def main() -> None:
    conversation_id = os.environ["TEAMS_CONVERSATION_ID"]

    app = App()
    await app.initialize()

    card = build_pr_card()
    result = await app.send(conversation_id, card)
    print(f"Sent to Teams: activity {result.id}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Failed to notify Teams: {e}", file=sys.stderr)
        sys.exit(1)
