export function getVectorLayerSourceByName(map, layerName) {
  if (!map) {
    return null;
  }

  const layer = map.getAllLayers().find((item) => item.get('name') === layerName);
  return layer?.getSource() || null;
}
