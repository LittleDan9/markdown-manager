import React, { useState, useEffect } from 'react';
import { Modal, Tab, Nav } from 'react-bootstrap';
import iconsApi from '../../../api/iconsApi';
import UploadIconTab from './UploadIconTab';
import IconPacksTab from './IconPacksTab';
import DeletePackTab from './DeletePackTab';
import IconifyBrowser from '../IconifyBrowser';
import InstalledIconsTab from './InstalledIconsTab';

export default function IconManagementModal({ show, onHide }) {
  const [activeTab, setActiveTab] = useState('packs');
  const [iconPacks, setIconPacks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [packNames, setPackNames] = useState([]); // Original backend pack names for comparison
  const [dropdownPackNames, setDropdownPackNames] = useState([]); // Pack names shown in dropdown
  const [loading, setLoading] = useState(false);

  // Load existing packs and categories on mount
  useEffect(() => {
    if (show) {
      setLoading(true);
      loadAllData().finally(() => setLoading(false));
    }
  }, [show]);

  const loadAllData = async () => {
    await Promise.all([
      loadIconPacks(),
      loadCategories(),
      loadPackNames()
    ]);
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
    setActiveTab('packs');
    onHide();
  };

  return (
    <Modal show={show} onHide={handleClose} size="xl" centered scrollable>
      <Modal.Header closeButton>
        <Modal.Title>
          <i className="bi bi-images me-2"></i>
          Icon Management
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <Tab.Container activeKey={activeTab} onSelect={setActiveTab}>
          <Nav variant="tabs" className="mb-3" style={{ position: 'sticky', top: 0, backgroundColor: 'var(--bs-body-bg)', zIndex: 10 }}>
            <Nav.Item>
              <Nav.Link eventKey="packs">
                <i className="bi bi-collection me-2"></i>
                Icon Packs ({iconPacks.length})
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
                Iconify Browser
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="delete">
                <i className="bi bi-trash me-2"></i>
                Delete Packs
              </Nav.Link>
            </Nav.Item>
          </Nav>

          <Tab.Content style={{ minHeight: '400px' }}>
            {/* Packs Tab */}
            <Tab.Pane eventKey="packs">
              <IconPacksTab iconPacks={iconPacks} onReloadData={loadAllData} loading={loading} />
            </Tab.Pane>

            {/* Installed Icons Tab */}
            <Tab.Pane eventKey="installed">
              <InstalledIconsTab iconPacks={iconPacks} onReloadData={loadAllData} packsLoading={loading} />
            </Tab.Pane>

            {/* Upload Tab */}
            <Tab.Pane eventKey="upload">
              <UploadIconTab
                categories={categories}
                packNames={packNames}
                dropdownPackNames={dropdownPackNames}
                onAddCategory={handleAddCategory}
                onAddPackName={handleAddPackName}
                onReloadData={loadAllData}
              />
            </Tab.Pane>

            {/* Iconify Browser Tab */}
            <Tab.Pane eventKey="browser">
              <IconifyBrowser onReloadData={loadAllData} />
            </Tab.Pane>

            {/* Delete Pack Tab */}
            <Tab.Pane eventKey="delete">
              <DeletePackTab
                iconPacks={iconPacks}
                onReloadData={loadAllData}
              />
            </Tab.Pane>
          </Tab.Content>
        </Tab.Container>
      </Modal.Body>
    </Modal>
  );
}
