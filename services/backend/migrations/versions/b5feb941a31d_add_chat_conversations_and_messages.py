"""add chat_conversations and chat_messages tables

Revision ID: b5feb941a31d
Revises: 293b510cbb08
Create Date: 2026-04-07 00:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b5feb941a31d'
down_revision: Union[str, Sequence[str], None] = '293b510cbb08'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create chat_conversations and chat_messages tables."""
    op.create_table(
        'chat_conversations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('scope', sa.String(length=20), nullable=True),
        sa.Column('document_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chat_conversations_id', 'chat_conversations', ['id'])
    op.create_index('ix_chat_conversations_user_id', 'chat_conversations', ['user_id'])

    op.create_table(
        'chat_messages',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('metadata_json', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['conversation_id'], ['chat_conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chat_messages_id', 'chat_messages', ['id'])
    op.create_index('ix_chat_messages_conversation_id', 'chat_messages', ['conversation_id'])


def downgrade() -> None:
    """Drop chat_messages and chat_conversations tables."""
    op.drop_index('ix_chat_messages_conversation_id', table_name='chat_messages')
    op.drop_index('ix_chat_messages_id', table_name='chat_messages')
    op.drop_table('chat_messages')
    op.drop_index('ix_chat_conversations_user_id', table_name='chat_conversations')
    op.drop_index('ix_chat_conversations_id', table_name='chat_conversations')
    op.drop_table('chat_conversations')
