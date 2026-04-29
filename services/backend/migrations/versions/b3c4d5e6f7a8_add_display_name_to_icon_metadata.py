"""Add display_name to icon_metadata

Revision ID: b3c4d5e6f7a8
Revises: e9f0a1b2c3d4
Create Date: 2026-04-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, Sequence[str], None] = 'e9f0a1b2c3d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def humanize_icon_key(key: str) -> str:
    """Generate a human-readable display name from an icon key.

    Examples:
        AmazonAWSNetworkLoadBalancer -> Network Load Balancer
        ec2 -> EC2
        lambda-function -> Lambda Function
        Arch_Amazon-EC2_48 -> EC2
    """
    import re

    name = key

    # Strip trailing size suffixes like _48, _64, _32
    name = re.sub(r'_(?:16|24|32|48|64|128)$', '', name)

    # Strip common prefixes (order matters - longest first)
    prefixes = [
        'Arch_Amazon-', 'Arch_AWS-', 'Arch_',
        'Res_Amazon-', 'Res_AWS-', 'Res_',
        'AmazonAWS', 'Amazon_', 'Amazon',
        'AWS_', 'AWS-', 'AWS',
    ]
    for prefix in prefixes:
        if name.startswith(prefix) and len(name) > len(prefix):
            name = name[len(prefix):]
            break

    # Replace hyphens and underscores with spaces
    name = re.sub(r'[-_]', ' ', name)

    # Split PascalCase/camelCase into words
    name = re.sub(r'([a-z])([A-Z])', r'\1 \2', name)
    name = re.sub(r'([A-Z]+)([A-Z][a-z])', r'\1 \2', name)

    # Normalize whitespace
    name = re.sub(r'\s+', ' ', name).strip()

    # Title-case each word, but keep known acronyms uppercase
    acronyms = {'ec2', 'vpc', 'rds', 'ecs', 'eks', 'iam', 'sqs', 'sns', 'api',
                's3', 'cdn', 'dns', 'http', 'https', 'tcp', 'udp', 'ip', 'ssl',
                'tls', 'ssh', 'ftp', 'sql', 'nosql', 'io', 'ai', 'ml', 'ci',
                'cd', 'nlb', 'alb', 'elb', 'nat', 'acm', 'kms', 'waf'}
    words = name.split()
    result_words = []
    for w in words:
        if w.lower() in acronyms:
            result_words.append(w.upper())
        elif w.isupper() and len(w) <= 4:
            result_words.append(w)  # Keep short all-caps as-is
        else:
            result_words.append(w.capitalize())
    name = ' '.join(result_words)

    return name if name else key


def upgrade() -> None:
    """Add display_name column and backfill from existing keys."""
    # Add the column as nullable
    op.add_column('icon_metadata', sa.Column(
        'display_name', sa.String(255), nullable=True,
        comment='Human-readable name like Network Load Balancer'
    ))

    # Backfill display_name for all existing icons using Python logic
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT id, key FROM icon_metadata WHERE display_name IS NULL"))
    for row in rows:
        display = humanize_icon_key(row.key)
        conn.execute(
            sa.text("UPDATE icon_metadata SET display_name = :display WHERE id = :id"),
            {"display": display, "id": row.id}
        )


def downgrade() -> None:
    """Remove display_name column."""
    op.drop_column('icon_metadata', 'display_name')
