/**
 * Chooses the connector implementation for a portal.
 *
 * The whole point of the layer is that this is the only place that knows which
 * concrete class exists. Pages ask for a connector and get the interface; when
 * a body grants API access, `portal_directory.connector_type` flips to 'api'
 * and this function starts returning a different class. Nothing else moves.
 */

import type { PhotoService } from '../photo.service';
import { ApiConnector } from './api.connector';
import { AssistedHandoffConnector } from './assisted-handoff.connector';
import type { Portal, PortalConnector } from './connector';

export function createConnector(portal: Portal, photos: PhotoService): PortalConnector {
  switch (portal.connector_type) {
    case 'api':
      return new ApiConnector(portal.jurisdiction, portal);

    case 'assisted':
      return new AssistedHandoffConnector(portal.jurisdiction, portal, photos);

    default: {
      // The column has a check constraint, so reaching here means the database
      // learned a third kind that this build does not have. Falling back to
      // assisted keeps the citizen able to file rather than stranding them on
      // an unknown connector type.
      const unknown: never = portal.connector_type;
      console.warn(`Unknown connector_type ${String(unknown)}; using assisted handoff.`);
      return new AssistedHandoffConnector(portal.jurisdiction, portal, photos);
    }
  }
}
