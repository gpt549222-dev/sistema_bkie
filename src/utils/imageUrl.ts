/**
 * Utilidades para normalización, optimización y resolución de enlaces de imágenes de productos.
 * Soporta Google Drive, Dropbox, Unsplash, GitHub, Imgur, Postimages, ImgBB,
 * enlaces de búsqueda de Google y enlaces directos de internet.
 */

export interface ImageServiceInfo {
  service: 'google_drive' | 'dropbox' | 'unsplash' | 'github' | 'imgur' | 'base64' | 'direct';
  label: string;
}

/**
 * Normaliza y convierte cualquier URL de imagen en un enlace directo descargable y renderizable.
 */
export function sanitizeImageUrl(url?: string | null): string | null {
  if (!url) return null;

  // 1. Limpieza inicial de espacios y caracteres invisibles
  let trimmed = url.trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  if (!trimmed) return null;

  // Si es un data URL Base64 (subido desde archivo local)
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }

  // 2. Extraer URLs envueltas en comillas, etiquetas HTML o formato Markdown
  // Markdown: ![alt](url) o [alt](url)
  const mdMatch = trimmed.match(/!?\[.*?\]\((https?:\/\/[^\s\)]+)\)/i);
  if (mdMatch && mdMatch[1]) {
    trimmed = mdMatch[1];
  }

  // HTML: <img src="url" /> o <a href="url">
  const htmlMatch = trimmed.match(/<(?:img|a)[^>]+(?:src|href)=["'](https?:\/\/[^"']+)["']/i);
  if (htmlMatch && htmlMatch[1]) {
    trimmed = htmlMatch[1];
  }

  // Eliminar comillas envolventes, llaves o signos accidentales
  trimmed = trimmed.replace(/^["'`<(\[]+|["'`>)\]]+$/g, '').trim();
  // Eliminar puntuación final accidental (comas, punto y coma)
  trimmed = trimmed.replace(/[,;]+$/, '').trim();

  // Si no tiene protocolo pero parece un dominio web con ruta (ej: images.unsplash.com/photo-...)
  if (/^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/.*)?$/i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  } else if (trimmed.startsWith('//')) {
    trimmed = `https:${trimmed}`;
  }

  // 3. Resolver enlaces de redirección de Google Images (google.com/imgres?imgurl=...)
  if (trimmed.includes('google.') && (trimmed.includes('imgurl=') || trimmed.includes('url='))) {
    try {
      const urlObj = new URL(trimmed);
      const realImgUrl = urlObj.searchParams.get('imgurl') || urlObj.searchParams.get('url');
      if (realImgUrl) {
        return sanitizeImageUrl(decodeURIComponent(realImgUrl));
      }
    } catch {
      // Continuar con regex si URL() falla
      const regexMatch = trimmed.match(/[?&](?:imgurl|url)=([^&]+)/);
      if (regexMatch && regexMatch[1]) {
        return sanitizeImageUrl(decodeURIComponent(regexMatch[1]));
      }
    }
  }

  // 4. GOOGLE DRIVE:
  // Convertir enlaces compartidos (/view?usp=sharing, /open?id=, /uc?id=) en enlace CDN directo
  // El endpoint de alto rendimiento 'https://lh3.googleusercontent.com/d/{FILE_ID}' entrega la imagen directamente sin headers de descarga ni páginas HTML
  const gDriveMatch = trimmed.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=[^&]+&)?id=|thumbnail\?id=)|docs\.google\.com\/uc\?id=)([a-zA-Z0-9_-]{20,})/i);
  if (gDriveMatch && gDriveMatch[1]) {
    const fileId = gDriveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // 5. DROPBOX:
  // Convertir enlaces de vista previa web de Dropbox (dl=0) en enlaces directos de descarga (raw=1)
  if (trimmed.includes('dropbox.com')) {
    let cleanDropbox = trimmed;
    // Si contiene dl=0, reemplazar por raw=1
    if (cleanDropbox.includes('dl=0')) {
      cleanDropbox = cleanDropbox.replace(/([?&])dl=0\b/g, '$1raw=1');
    } else if (!cleanDropbox.includes('raw=1') && !cleanDropbox.includes('dl=1')) {
      const sep = cleanDropbox.includes('?') ? '&' : '?';
      cleanDropbox = `${cleanDropbox}${sep}raw=1`;
    }
    // Reemplazar www.dropbox.com por dl.dropboxusercontent.com para saltarse la interfaz web
    cleanDropbox = cleanDropbox.replace('www.dropbox.com', 'dl.dropboxusercontent.com');
    return cleanDropbox;
  }

  // 6. GITHUB:
  // Convertir enlaces de visor blob de GitHub en raw.githubusercontent.com
  // Ej: https://github.com/user/repo/blob/main/img.png -> https://raw.githubusercontent.com/user/repo/main/img.png
  const githubBlobMatch = trimmed.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/i);
  if (githubBlobMatch) {
    const [, user, repo, branch, path] = githubBlobMatch;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }

  // 7. GITLAB:
  // Convertir visor blob en raw
  const gitlabBlobMatch = trimmed.match(/^https?:\/\/gitlab\.com\/([^/]+)\/([^/]+)\/-\/blob\/([^/]+)\/(.+)$/i);
  if (gitlabBlobMatch) {
    const [, user, repo, branch, path] = gitlabBlobMatch;
    return `https://gitlab.com/${user}/${repo}/-/raw/${branch}/${path}`;
  }

  // 8. UNSPLASH:
  // Si pegan la página de la foto (unsplash.com/photos/PHOTO_ID), optimizar a images.unsplash.com
  const unsplashPageMatch = trimmed.match(/^https?:\/\/(?:www\.)?unsplash\.com\/photos\/(?:[a-zA-Z0-9_-]+-)?([a-zA-Z0-9_-]+)$/i);
  if (unsplashPageMatch && unsplashPageMatch[1]) {
    return `https://images.unsplash.com/photo-${unsplashPageMatch[1]}?auto=format&fit=crop&w=800&q=80`;
  }
  // Si ya es de images.unsplash.com pero no tiene parámetros de calidad y tamaño
  if (trimmed.includes('images.unsplash.com') && !trimmed.includes('auto=format')) {
    const separator = trimmed.includes('?') ? '&' : '?';
    return `${trimmed}${separator}auto=format&fit=crop&w=800&q=80`;
  }

  // 9. IMGUR:
  // Si pegan enlace de página html (imgur.com/ABC1234), convertir a enlace directo de imagen i.imgur.com/ABC1234.jpg
  const imgurMatch = trimmed.match(/^https?:\/\/(?:m\.)?imgur\.com\/([a-zA-Z0-9]{5,8})$/i);
  if (imgurMatch && imgurMatch[1]) {
    return `https://i.imgur.com/${imgurMatch[1]}.jpg`;
  }

  // 10. POSTIMAGES:
  // https://postimg.cc/ABCDEF -> https://i.postimg.cc/ABCDEF/image.jpg
  const postimgMatch = trimmed.match(/^https?:\/\/postimg\.cc\/([a-zA-Z0-9]+)$/i);
  if (postimgMatch && postimgMatch[1]) {
    return `https://i.postimg.cc/${postimgMatch[1]}/image.jpg`;
  }

  // 11. IMGBB:
  // https://ibb.co/ABCDEF -> https://i.ibb.co/ABCDEF/image.jpg
  const ibbMatch = trimmed.match(/^https?:\/\/ibb\.co\/([a-zA-Z0-9]+)$/i);
  if (ibbMatch && ibbMatch[1]) {
    return `https://i.ibb.co/${ibbMatch[1]}/image.jpg`;
  }

  // 12. Actualización de HTTP inseguro a HTTPS para evitar bloqueos por Mixed Content
  if (trimmed.startsWith('http://') && !trimmed.includes('localhost') && !trimmed.includes('127.0.0.1')) {
    trimmed = trimmed.replace(/^http:\/\//i, 'https://');
  }

  return trimmed;
}

/**
 * Genera una lista ordenada de URLs alternativas (fallbacks) para una imagen dada.
 * Si la URL primaria falla (por ejemplo por hotlink protection o restricciones de red),
 * el componente intentará cargar las alternativas antes de mostrar el placeholder.
 */
export function getImageCandidates(url?: string | null): string[] {
  const primary = sanitizeImageUrl(url);
  if (!primary) return [];
  if (primary.startsWith('data:image/')) return [primary];

  const candidates: string[] = [primary];

  // Alternativas específicas para Google Drive
  const gDriveMatch = primary.match(/(?:drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=|thumbnail\?id=)|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]{20,})/i);
  if (gDriveMatch && gDriveMatch[1]) {
    const fileId = gDriveMatch[1];
    const alt1 = `https://lh3.googleusercontent.com/d/${fileId}`;
    const alt2 = `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
    const alt3 = `https://drive.google.com/uc?export=view&id=${fileId}`;
    [alt1, alt2, alt3].forEach((c) => {
      if (!candidates.includes(c)) candidates.push(c);
    });
  }

  // Alternativas específicas para Dropbox
  if (primary.includes('dropbox')) {
    if (primary.includes('dl.dropboxusercontent.com')) {
      const alt = primary.replace('dl.dropboxusercontent.com', 'www.dropbox.com').replace(/\braw=1\b/, 'dl=1');
      if (!candidates.includes(alt)) candidates.push(alt);
    }
  }

  // Si es un enlace HTTP/HTTPS regular de internet, agregar proxy CDN resistente a hotlinking (wsrv.nl)
  if (
    (primary.startsWith('http://') || primary.startsWith('https://')) &&
    !primary.includes('wsrv.nl') &&
    !primary.includes('weserv.nl') &&
    !primary.includes('localhost')
  ) {
    // wsrv.nl es un proxy/caché de imágenes gratuito con Cloudflare CDN que sortea bloqueos de Referer
    const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(primary)}&output=webp&q=85`;
    candidates.push(proxyUrl);
  }

  return candidates;
}

/**
 * Detecta el servicio de origen de la imagen para proveer información útil al usuario en el formulario.
 */
export function detectImageService(url?: string | null): ImageServiceInfo | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/')) {
    return { service: 'base64', label: 'Foto subida localmente' };
  }
  if (trimmed.includes('drive.google.com') || trimmed.includes('lh3.googleusercontent.com/d/')) {
    return { service: 'google_drive', label: 'Google Drive (convertido a CDN directo)' };
  }
  if (trimmed.includes('dropbox.com') || trimmed.includes('dropboxusercontent.com')) {
    return { service: 'dropbox', label: 'Dropbox (convertido a enlace directo)' };
  }
  if (trimmed.includes('unsplash.com')) {
    return { service: 'unsplash', label: 'Unsplash (optimizado HD)' };
  }
  if (trimmed.includes('github.com') || trimmed.includes('githubusercontent.com')) {
    return { service: 'github', label: 'GitHub Raw' };
  }
  if (trimmed.includes('imgur.com')) {
    return { service: 'imgur', label: 'Imgur directo' };
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return { service: 'direct', label: 'Enlace web directo' };
  }
  return null;
}
