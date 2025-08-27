import React, { useState, useEffect } from 'react';
import { Card, Button, List, message, Modal, Space, Tag, Typography } from 'antd';
import { GithubOutlined, LinkOutlined, DisconnectOutlined } from '@ant-design/icons';
import { api } from '../../services/api';

const { Title, Text } = Typography;

const GitHubIntegration = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [repositories, setRepositories] = useState([]);

  // Load GitHub accounts on component mount
  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/github/accounts');
      setAccounts(response.data);
    } catch (error) {
      console.error('Failed to load GitHub accounts:', error);
      message.error('Failed to load GitHub accounts');
    } finally {
      setLoading(false);
    }
  };

  const connectGitHub = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/github/auth/url');
      const { authorization_url } = response.data;

      // Open GitHub OAuth in a new window
      const popup = window.open(
        authorization_url,
        'github-oauth',
        'width=600,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the OAuth callback
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed);
          setLoading(false);
          // Refresh accounts after OAuth
          loadAccounts();
          message.success('GitHub account connected successfully!');
        }
      }, 1000);

    } catch (error) {
      console.error('Failed to initiate GitHub OAuth:', error);
      message.error('Failed to connect to GitHub');
      setLoading(false);
    }
  };

  const disconnectAccount = async (accountId) => {
    try {
      await api.delete(`/api/github/accounts/${accountId}`);
      message.success('GitHub account disconnected');
      loadAccounts();
    } catch (error) {
      console.error('Failed to disconnect GitHub account:', error);
      message.error('Failed to disconnect GitHub account');
    }
  };

  const loadRepositories = async (accountId) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/github/repositories?account_id=${accountId}`);
      setRepositories(response.data);
    } catch (error) {
      console.error('Failed to load repositories:', error);
      message.error('Failed to load repositories');
    } finally {
      setLoading(false);
    }
  };

  const syncRepositories = async (accountId) => {
    try {
      setLoading(true);
      await api.post(`/api/github/repositories/sync?account_id=${accountId}`);
      message.success('Repositories synced successfully');
      loadRepositories(accountId);
    } catch (error) {
      console.error('Failed to sync repositories:', error);
      message.error('Failed to sync repositories');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>
        <GithubOutlined /> GitHub Integration
      </Title>

      <Card
        title="Connected Accounts"
        extra={
          <Button
            type="primary"
            icon={<LinkOutlined />}
            onClick={connectGitHub}
            loading={loading}
          >
            Connect GitHub Account
          </Button>
        }
        style={{ marginBottom: '24px' }}
      >
        {accounts.length === 0 ? (
          <Text type="secondary">
            No GitHub accounts connected. Click "Connect GitHub Account" to get started.
          </Text>
        ) : (
          <List
            dataSource={accounts}
            renderItem={(account) => (
              <List.Item
                actions={[
                  <Button
                    onClick={() => loadRepositories(account.id)}
                    size="small"
                  >
                    View Repositories
                  </Button>,
                  <Button
                    onClick={() => syncRepositories(account.id)}
                    size="small"
                    type="dashed"
                  >
                    Sync Repos
                  </Button>,
                  <Button
                    danger
                    size="small"
                    icon={<DisconnectOutlined />}
                    onClick={() => disconnectAccount(account.id)}
                  >
                    Disconnect
                  </Button>
                ]}
              >
                <List.Item.Meta
                  avatar={
                    account.avatar_url ? (
                      <img
                        src={account.avatar_url}
                        alt={account.username}
                        style={{ width: 40, height: 40, borderRadius: '50%' }}
                      />
                    ) : (
                      <GithubOutlined style={{ fontSize: '24px' }} />
                    )
                  }
                  title={
                    <Space>
                      <Text strong>{account.display_name || account.username}</Text>
                      <Tag color="blue">@{account.username}</Tag>
                      {account.is_active ? (
                        <Tag color="green">Active</Tag>
                      ) : (
                        <Tag color="red">Inactive</Tag>
                      )}
                    </Space>
                  }
                  description={account.email}
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {repositories.length > 0 && (
        <Card title="Repositories" style={{ marginBottom: '24px' }}>
          <List
            dataSource={repositories}
            renderItem={(repo) => (
              <List.Item
                actions={[
                  <Button size="small">Browse Files</Button>,
                  <Button size="small" type="primary">Import Files</Button>
                ]}
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{repo.repo_name}</Text>
                      {repo.is_private && <Tag color="orange">Private</Tag>}
                      <Tag color="blue">{repo.default_branch}</Tag>
                    </Space>
                  }
                  description={repo.description || 'No description'}
                />
              </List.Item>
            )}
          />
        </Card>
      )}
    </div>
  );
};

export default GitHubIntegration;
