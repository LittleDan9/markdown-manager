import React, { useState } from 'react';
import { Form, Button, Alert, Card, Spinner } from 'react-bootstrap';
import { useNotification } from '../../NotificationProvider';
import { adminIconsApi } from '../../../api/admin';
import PackCategorySelector from '../common/PackCategorySelector';

export default function IconifyPackTab({
  categories,
  onAddCategory,
  onReloadData
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Iconify pack form state
  const [iconifyForm, setIconifyForm] = useState({
    packUrl: '',
    packName: '',
    category: categories.length > 0 ? categories[0] : '',
    description: ''
  });

  const { showSuccess, showError } = useNotification();

  const handleIconifyFormChange = (field, value) => {
    setIconifyForm(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear errors when user types
    if (error) setError('');
  };

  const validateIconifyForm = () => {
    if (!iconifyForm.packUrl.trim()) {
      setError('Iconify pack URL is required.');
      return false;
    }
    if (!iconifyForm.packName.trim()) {
      setError('Pack name is required.');
      return false;
    }
    if (!iconifyForm.category) {
      setError('Category is required.');
      return false;
    }

    // Validate URL format
    try {
      new URL(iconifyForm.packUrl);
    } catch {
      setError('Please enter a valid URL.');
      return false;
    }

    // Validate pack name format
    const nameRegex = /^[a-z0-9-]+$/;
    if (!nameRegex.test(iconifyForm.packName)) {
      setError('Pack name must contain only lowercase letters, numbers, and hyphens.');
      return false;
    }

    return true;
  };

  const installIconifyPack = async () => {
    if (!validateIconifyForm()) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      let packData;

      // Check if it's a direct JSON URL or needs to be converted to collection API
      if (iconifyForm.packUrl.includes('.json')) {
        // It's a direct JSON URL, try to fetch it first
        try {
          const response = await fetch(iconifyForm.packUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch pack: ${response.statusText}`);
          }
          packData = await response.json();
        } catch (err) {
          // If direct JSON fails, try to convert to collection API format
          const urlParts = iconifyForm.packUrl.split('/');
          const filename = urlParts[urlParts.length - 1];
          const prefix = filename.replace('.json', '');

          const collectionUrl = `https://api.iconify.design/collection?prefix=${prefix}&info=1`;
          const response = await fetch(collectionUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch collection: ${response.statusText}. Original error: ${err.message}`);
          }
          packData = await response.json();
        }
      } else {
        // Assume it's already a collection API URL
        const response = await fetch(iconifyForm.packUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch pack: ${response.statusText}`);
        }
        packData = await response.json();
      }

      // Handle different response formats
      let icons, info;

      if (packData.icons && packData.info) {
        // Direct icon data format
        icons = packData.icons;
        info = packData.info;
      } else if (packData.prefix && packData.info) {
        // Collection API format - we need to fetch the actual icon data
        const iconDataUrl = `https://api.iconify.design/${packData.prefix}.json?icons=${Object.keys(packData.uncategorized || []).concat(
          Object.values(packData.categories || {}).flat()
        ).slice(0, 50).join(',')}`; // Limit to first 50 icons for now

        const iconResponse = await fetch(iconDataUrl);
        if (!iconResponse.ok) {
          throw new Error(`Failed to fetch icon data: ${iconResponse.statusText}`);
        }
        const iconData = await iconResponse.json();

        icons = iconData.icons;
        info = packData.info;
      } else {
        throw new Error('Invalid Iconify pack format. Expected either icon data with "icons" and "info" fields, or collection metadata with "prefix" and "info" fields.');
      }

      // Create the pack data in the expected format
      const customPackData = {
        // Preserve pack-level dimensions for proper viewBox calculation
        width: packData.width,
        height: packData.height,
        icons,
        info: {
          ...info,
          name: iconifyForm.packName,
          displayName: iconifyForm.packName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          category: iconifyForm.category,
          description: iconifyForm.description || info.description || `${iconifyForm.packName} icons`
        }
      };

      // Install the pack using the existing API
      const result = await adminIconsApi.installIconPack(customPackData, null, 'json');

      setSuccess(`Successfully installed Iconify pack &quot;${result.display_name}&quot; with ${Object.keys(icons).length} icons`);
      showSuccess(`Iconify pack &quot;${result.display_name}&quot; installed successfully!`);

      // Reset form
      setIconifyForm({
        packUrl: '',
        packName: '',
        category: categories.length > 0 ? categories[0] : '',
        description: ''
      });

      // Reload data via parent
      onReloadData();

    } catch (err) {
      const errorMessage = err.message || 'Failed to install Iconify pack';
      setError(errorMessage);
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="icon-pack-tab">
      <Card>
        <Card.Header>
          <h5 className="mb-0">Install Iconify Pack</h5>
        </Card.Header>
        <Card.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

        <Alert variant="info" className="mb-3">
          <Alert.Heading as="h6">
            <i className="bi bi-info-circle me-2"></i>
            Iconify API URL Formats
          </Alert.Heading>
          <small>
            <strong>Direct JSON (Recommended):</strong> <code>https://api.iconify.design/PREFIX.json?icons=icon1,icon2,icon3</code><br/>
            <strong>Collection API (Limited):</strong> <code>https://api.iconify.design/collection?prefix=PREFIX&info=1</code><br/>
            <strong>Find Icon Packs:</strong> Browse <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener noreferrer">icon-sets.iconify.design</a> or <a href="https://iconify.design/icon-sets/" target="_blank" rel="noopener noreferrer">iconify.design/icon-sets</a><br/>
            <strong>Get Icon Names:</strong> Use the Iconify website to find specific icon names for your pack.
          </small>
        </Alert>

        <Form>
          <div className="row">
            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Iconify Pack URL *</Form.Label>
                <Form.Control
                  type="url"
                  value={iconifyForm.packUrl}
                  onChange={(e) => handleIconifyFormChange('packUrl', e.target.value)}
                  placeholder="https://api.iconify.design/fa6-solid.json?icons=house,heart,star,user,search,check,times,arrow-left,arrow-right,arrow-up"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  <strong>URL Format Examples:</strong><br/>
                  • <strong>Direct JSON:</strong> https://api.iconify.design/fa6-solid.json?icons=house,heart,star,user<br/>
                  • <strong>Collection API:</strong> https://api.iconify.design/collection?prefix=heroicons&info=1<br/>
                  • <strong>Find more packs:</strong> <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener noreferrer">Browse Iconify Icon Sets</a>
                </Form.Text>
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Pack Name *</Form.Label>
                <Form.Control
                  type="text"
                  value={iconifyForm.packName}
                  onChange={(e) => handleIconifyFormChange('packName', e.target.value)}
                  placeholder="e.g., material-icons"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  Lowercase letters, numbers, and hyphens only
                </Form.Text>
              </Form.Group>

              <PackCategorySelector
                showPackName={false}
                category={iconifyForm.category}
                onCategoryChange={(value) => handleIconifyFormChange('category', value)}
                categories={categories}
                onAddCategory={onAddCategory}
                categoryLabel="Category"
                categoryPlaceholder="Select a category"
                categoryRequired={true}
                loading={loading}
                disabled={loading}
              />
            </div>

            <div className="col-md-6">
              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={iconifyForm.description}
                  onChange={(e) => handleIconifyFormChange('description', e.target.value)}
                  placeholder="Optional description for the icon pack"
                  disabled={loading}
                />
                <Form.Text className="text-muted">
                  If empty, will use description from Iconify pack
                </Form.Text>
              </Form.Group>

              <Card className="mb-3">
                <Card.Header>
                  <h6 className="mb-0">Quick-Fill Popular Collections</h6>
                </Card.Header>
                <Card.Body>
                  <div className="row">
                    <div className="col-12">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/mdi.json?icons=home,heart,star,account,magnify,check,close,arrow-left,arrow-right,arrow-up,arrow-down,plus,minus,pencil,delete,content-save,content-copy,download,upload,settings,information,alert,check-circle,calendar,clock,email,phone,map-marker,camera,image,video,music,file,folder,text-box,format-bold,format-italic,format-underline,link,view-list,table,chart-line,view-dashboard,menu,view-grid,filter,sort-ascending,refresh,sync,lock,lock-open,eye,eye-off,share,thumb-up,heart-outline,bookmark,tag,flag,bell,message,chat,reply,send,printer,qrcode,wifi,bluetooth,battery,signal,volume-high,brightness-6,zoom-in,fullscreen,window-minimize,window-maximize,close,cancel,check-bold,block-helper');
                          handleIconifyFormChange('packName', 'material-design-icons');
                        }}
                      >
                        Material Design Icons
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/fa6-solid.json?icons=house,heart,star,user,search,check,times,arrow-left,arrow-right,arrow-up,arrow-down,plus,minus,edit,trash,save,copy,download,upload,home,settings,info,warning,error,success,calendar,clock,mail,phone,map,location,camera,image,video,music,file,folder,document,text,bold,italic,underline,link,list,table,chart,graph,dashboard,menu,grid,filter,sort,refresh,sync,lock,unlock,eye,hide,share,like,favorite,bookmark,tag,flag,bell,notification,message,chat,comment,reply,send,receive,print,scan,barcode,qr-code,wifi,bluetooth,battery,signal,volume,brightness,contrast,zoom,fullscreen,minimize,maximize,close,cancel,confirm,approve,deny,block,allow,play,pause,stop,forward,backward,repeat,shuffle,previous,next,first,last,skip,record,microphone,speaker,headphones');
                          handleIconifyFormChange('packName', 'font-awesome-solid');
                        }}
                      >
                        Font Awesome Solid
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/heroicons.json?icons=home,heart,star,user,magnifying-glass,check,x-mark,arrow-left,arrow-right,arrow-up,arrow-down,plus,minus,pencil,trash,bookmark,tag,bell,chat-bubble-left,envelope,phone,map-pin,camera,photo,video,musical-note,document,folder,cog-6-tooth,information-circle,exclamation-triangle,check-circle,calendar,clock,wifi,lock-closed,eye,eye-slash,share,heart-outline');
                          handleIconifyFormChange('packName', 'heroicons');
                        }}
                      >
                        Heroicons
                      </Button>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        className="me-2 mb-2"
                        onClick={() => {
                          handleIconifyFormChange('packUrl', 'https://api.iconify.design/lucide.json?icons=home,heart,star,user,search,check,x,arrow-left,arrow-right,arrow-up,arrow-down,plus,minus,edit,trash-2,save,copy,download,upload,settings,info,alert-triangle,check-circle,calendar,clock,mail,phone,map-pin,camera,image,video,music,file,folder,type,bold,italic,underline,link,list,table,bar-chart,menu,grid,filter,refresh,lock,unlock,eye,eye-off,share,thumbs-up,bookmark,tag,flag,bell,message-circle');
                          handleIconifyFormChange('packName', 'lucide');
                        }}
                      >
                        Lucide
                      </Button>
                    </div>
                  </div>
                  <small className="text-muted">
                    <strong>Quick-fill buttons above use optimized direct JSON URLs.</strong><br/>
                    Visit <a href="https://icon-sets.iconify.design/" target="_blank" rel="noopener noreferrer">icon-sets.iconify.design</a> to find more icon packs and their prefix names.
                  </small>
                </Card.Body>
              </Card>
            </div>
          </div>

          <div className="d-flex justify-content-end">
            <Button
              variant="primary"
              onClick={installIconifyPack}
              disabled={loading || !iconifyForm.packUrl || !iconifyForm.packName}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Installing...
                </>
              ) : (
                <>
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
                  Install Iconify Pack
                </>
              )}
            </Button>
          </div>
        </Form>
      </Card.Body>
    </Card>
    </div>
  );
}
