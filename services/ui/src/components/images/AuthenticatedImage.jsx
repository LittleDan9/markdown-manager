// Authenticated Image Component
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import imageCacheService from '@/services/rendering/ImageCacheService';
import imageApi from '@/api/imageApi';

/**
 * AuthenticatedImage component that fetches images with authentication
 * and displays them using blob URLs
 */
export default function AuthenticatedImage({
  filename,
  useThumbnail = false,
  fallbackSrc = null,
  alt = '',
  className = '',
  style = {},
  onLoad = null,
  onError = null,
  ...props
}) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { user } = useAuth();
  const blobUrlRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!filename || !user?.id) {
        setError(true);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(false);

        // Use ImageCacheService for memory-level caching
        const cacheKey = `auth:${user.id}:${useThumbnail ? 'thumb:' : ''}${filename}`;
        const cached = imageCacheService.cache.get(cacheKey);

        let url;
        if (cached) {
          url = cached;
        } else {
          url = useThumbnail
            ? await imageApi.getThumbnailBlobUrl(filename, user.id)
            : await imageApi.getImageBlobUrl(filename, user.id);

          if (url) {
            imageCacheService.cache.set(cacheKey, url);
          }
        }

        if (isMounted) {
          if (url) {
            blobUrlRef.current = url;
            setBlobUrl(url);
          } else {
            setError(true);
          }
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to load authenticated image:', err);
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [filename, useThumbnail, user?.id]);

  const handleLoad = (e) => {
    setLoading(false);
    if (onLoad) onLoad(e);
  };

  const handleError = (e) => {
    setError(true);
    setLoading(false);
    if (onError) onError(e);
  };

  if (loading) {
    return (
      <div
        className={`d-flex align-items-center justify-content-center ${className}`}
        style={{
          minHeight: '100px',
          backgroundColor: '#f8f9fa',
          ...style
        }}
        {...props}
      >
        <div className="spinner-border spinner-border-sm text-secondary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !blobUrl) {
    if (fallbackSrc) {
      return (
        <img
          src={fallbackSrc}
          alt={alt}
          className={className}
          style={style}
          onLoad={handleLoad}
          onError={handleError}
          {...props}
        />
      );
    }

    return (
      <div
        className={`d-flex align-items-center justify-content-center ${className}`}
        style={{
          minHeight: '100px',
          backgroundColor: '#f8f9fa',
          border: '1px dashed #dee2e6',
          ...style
        }}
        {...props}
      >
        <div className="text-muted text-center">
          <i className="bi bi-image" style={{ fontSize: '2rem' }}></i>
          <div className="small mt-1">Failed to load image</div>
        </div>
      </div>
    );
  }

  return (
    <img
      src={blobUrl}
      alt={alt}
      className={className}
      style={style}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
}