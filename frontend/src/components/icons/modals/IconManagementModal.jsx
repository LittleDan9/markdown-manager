import React, { useState, useEffect } from 'react';
import { Modal, Tab, Nav } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import UploadIconTab from './UploadIconTab';
import IconStatsTab from './IconStatsTab';
import IconPacksTab from './IconPacksTab';
import ThirdPartyIconBrowser from '../ThirdPartyIconBrowser';
import InstalledIconsTab from './InstalledIconsTab';

export default function IconManagementModal({ show, onHide }) {
  const [activeTab, setActiveTab] = useState('stats');
  const [iconPacks, setIconPacks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [packNames, setPackNames] = useState([]); // Original backend pack names for comparison
  const [dropdownPackNames, setDropdownPackNames] = useState([]); // Pack names shown in dropdown
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false); // Track if we've loaded data for this session

  // Load existing packs and categories on mount
  useEffect(() => {
    if (show && !dataLoaded) {
      setLoading(true);
      loadAllData()
        .then(() => setDataLoaded(true))
        .finally(() => setLoading(false));
    }
  }, [show, dataLoaded]);

  const loadAllData = async () => {
    // Load data sequentially to avoid hitting rate limits
    // Start with the most critical data first
    try {
      await loadIconPacks();
      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadCategories();
      await new Promise(resolve => setTimeout(resolve, 100));
      await loadPackNames();
    } catch (error) {
      console.error('Error loading icon management data:', error);
    }
  };

  const handleReloadData = async () => {
    setDataLoaded(false); // Reset cache flag to force reload
    setLoading(true);
    await loadAllData();
    setDataLoaded(true);
    setLoading(false);
  };

  const loadIconPacks = async () => {
    try {
      const packs = await iconsApi.getIconPacks();
      setIconPacks(packs);
    } catch (err) {
      console.error('Failed to load icon packs:', err);
    }
  };

  const loadCategories = async () => {
    try {
      const apiCategories = await iconsApi.getIconCategories();
      const sortedCategories = [...apiCategories].sort();
      setCategories(sortedCategories);
    } catch (err) {
      console.error('Failed to load categories:', err);
      // If backend is down, categories list should be empty
      setCategories([]);
    }
  };

  const loadPackNames = async () => {
    try {
      const apiPackNames = await iconsApi.getIconPackNames();
      const sortedPackNames = [...apiPackNames].sort();
      setPackNames(sortedPackNames); // Original backend pack names
      setDropdownPackNames(sortedPackNames); // Initially same as backend
    } catch (err) {
      console.error('Failed to load pack names:', err);
      // If backend is down, both lists should be empty
      setPackNames([]);
      setDropdownPackNames([]);
    }
  };

  const handleAddCategory = (category) => {
    // Add category to local list for dropdown display
    const updatedCategories = [...categories, category].sort();
    setCategories(updatedCategories);
  };

  const handleAddPackName = (packName) => {
    // Add to dropdown pack names (for display)
    const updatedDropdownPackNames = [...dropdownPackNames, packName].sort();
    setDropdownPackNames(updatedDropdownPackNames);
  };

  const handleClose = () => {
    setActiveTab('stats');
    onHide();
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      centered
      className="icon-management-modal"
      style={{ height: '90vh' }}
    >
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-images me-2"></i>
          Icon Management
        </Modal.Title>
      </Modal.Header>
      <Modal.Body className="d-flex flex-column" style={{ height: 'calc(90vh - 120px)', padding: 0 }}>
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab} className="tab-container h-100 d-flex flex-column">
          <Nav variant="tabs" className="mb-0 flex-shrink-0" style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bs-body-bg)', zIndex: 10, padding: '1rem 1rem 0 1rem' }}>
            <Nav.Item>
              <Nav.Link eventKey="stats">
                <i className="bi bi-speedometer2 me-2"></i>
                Statistics
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="packs">
                <i className="bi bi-collection me-2"></i>
                Icon Packs
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="installed">
                <i className="bi bi-grid-3x3-gap me-2"></i>
                Installed Icons
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="upload">
                <i className="bi bi-upload me-2"></i>
                Upload Icon
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="browser">
                <svg
                  className="me-2"
                  width="20"
                  height="20"
                  viewBox="0 0 48 48"
                  fill="none"
                  style={{ verticalAlign: 'text-top' }}
                >
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M14 6v6"/>
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M10 16v22"/>
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M38 16v22M38 38H10"/>
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="m24 6 17 11"/>
                  <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M24 6 7 17"/>
                  <path stroke="currentColor" strokeLinecap="round" strokeWidth="4" d="M24 25v16"/>
                  <circle cx="24" cy="23" r="4" fill="currentColor"/>
                </svg>
                Icon Browser
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content className="flex-grow-1 overflow-hidden" style={{ padding: '1rem' }}>
            {/* Statistics Tab */}
            <Tab.Pane eventKey="stats" className="h-100">
              <div className="h-100 overflow-auto">
                <IconStatsTab iconPacks={iconPacks} onReloadData={handleReloadData} loading={loading} />
              </div>
            </Tab.Pane>

            {/* Icon Packs Tab */}
            <Tab.Pane eventKey="packs" className="h-100">
              <div className="h-100 overflow-auto">
                <IconPacksTab iconPacks={iconPacks} onReloadData={handleReloadData} loading={loading} />
              </div>
            </Tab.Pane>

            {/* Installed Icons Tab */}
            <Tab.Pane eventKey="installed" className="h-100">
              <div className="h-100 overflow-auto">
                <InstalledIconsTab iconPacks={iconPacks} onReloadData={handleReloadData} packsLoading={loading} />
              </div>
            </Tab.Pane>

            {/* Upload Tab */}
            <Tab.Pane eventKey="upload" className="h-100">
              <div className="h-100 overflow-auto">
                <UploadIconTab
                  categories={categories}
                  packNames={packNames}
                  dropdownPackNames={dropdownPackNames}
                  onAddCategory={handleAddCategory}
                  onAddPackName={handleAddPackName}
                  onReloadData={handleReloadData}
                />
              </div>
            </Tab.Pane>

            {/* Third-Party Icons Browser Tab */}
            <Tab.Pane eventKey="browser" className="h-100">
              <div className="h-100 overflow-auto">
                <ThirdPartyIconBrowser
                  categories={categories}
                  packNames={packNames}
                  dropdownPackNames={dropdownPackNames}
                  onAddCategory={handleAddCategory}
                  onAddPackName={handleAddPackName}
                  onReloadData={handleReloadData}
                />
              </div>
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}
