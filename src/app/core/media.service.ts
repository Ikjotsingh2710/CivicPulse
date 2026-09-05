import { Injectable } from '@angular/core';

import { environment } from '../../environments/environment';
import { supabase } from './supabase.client';
import { describeSupabaseError } from './supabase.errors';

const BUCKET = 'ticket-photos';

/**
 * Uploads ticket photos and returns a public URL.
 *
 * Cloudinary is the intended host (unsigned preset, so no secret reaches the
 * browser). When it is not configured the upload falls back to the public
 * Supabase Storage bucket created in migration 0001, so the app is usable
 * before Cloudinary credentials exist.
 */
@Injectable({ providedIn: 'root' })
export class MediaService {
  readonly usingCloudinary = Boolean(
    environment.cloudinary.cloudName && environment.cloudinary.unsignedPreset,
  );

  async upload(file: File, folder: 'reports' | 'resolutions' = 'reports'): Promise<string> {
    return this.usingCloudinary
      ? this.uploadToCloudinary(file, folder)
      : this.uploadToSupabase(file, folder);
  }

  private async uploadToCloudinary(file: File, folder: string): Promise<string> {
    const { cloudName, unsignedPreset } = environment.cloudinary;

    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', unsignedPreset);
    form.append('folder', `civicpulse/${folder}`);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      throw new Error(`Cloudinary upload failed (${response.status}).`);
    }

    const payload = (await response.json()) as { secure_url?: string };
    if (!payload.secure_url) throw new Error('Cloudinary returned no URL.');
    return payload.secure_url;
  }

  private async uploadToSupabase(file: File, folder: string): Promise<string> {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, file, { contentType: file.type || 'image/jpeg', upsert: false });

    if (error) throw new Error(describeSupabaseError(error, 'Photo upload failed.'));

    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }
}
