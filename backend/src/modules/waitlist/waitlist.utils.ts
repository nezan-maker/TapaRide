export type OrderedStop = {
  stationId: string;
  order: number;
};

export function getCandidateStopIds(
  stops: OrderedStop[],
  currentStopId: string,
) {
  const currentStop = stops.find((stop) => stop.stationId === currentStopId);
  if (!currentStop) {
    return [currentStopId];
  }

  return stops
    .filter((stop) => stop.order >= currentStop.order)
    .sort((left, right) => left.order - right.order)
    .map((stop) => stop.stationId);
}
