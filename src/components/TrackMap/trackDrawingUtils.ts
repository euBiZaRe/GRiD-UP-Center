export const setupCanvasContext = (
  ctx: CanvasRenderingContext2D,
  scale: number,
  offsetX: number,
  offsetY: number,
  isMinimal = false
) => {
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);

  if (!isMinimal) {
    ctx.shadowColor = 'black';
    ctx.shadowBlur = 2;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 1;
  }
};

export const drawTrack = (
  ctx: CanvasRenderingContext2D,
  path2DObjects: { inside: Path2D | null },
  invertTrackColors: boolean,
  trackLineWidth: number,
  trackOutlineWidth: number,
  isMinimal = false
) => {
  if (!path2DObjects.inside) return;

  const outlineColor = '#111111';
  const trackColor = '#333333';

  if (!isMinimal) {
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = trackOutlineWidth;
    ctx.stroke(path2DObjects.inside);
  }

  ctx.strokeStyle = trackColor;
  ctx.lineWidth = trackLineWidth;
  ctx.stroke(path2DObjects.inside);
};

export const drawStartFinishLine = (
  ctx: CanvasRenderingContext2D,
  startFinishLine: any
) => {
  if (!startFinishLine || !startFinishLine.point) return;

  const lineLength = 60;
  const { point: sfPoint, perpendicular } = startFinishLine;

  const startX = sfPoint.x - (perpendicular.x * lineLength) / 2;
  const startY = sfPoint.y - (perpendicular.y * lineLength) / 2;
  const endX = sfPoint.x + (perpendicular.x * lineLength) / 2;
  const endY = sfPoint.y + (perpendicular.y * lineLength) / 2;

  ctx.lineWidth = 20;
  ctx.strokeStyle = '#ff0000';
  ctx.lineCap = 'square';

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
};

export const drawDrivers = (
  ctx: CanvasRenderingContext2D,
  calculatePositions: any,
  driverCircleSize: number,
  playerCircleSize: number,
  hiddenClasses: Set<number>
) => {
  Object.values(calculatePositions)
    .sort((a: any, b: any) => Number(a.isPlayer) - Number(b.isPlayer))
    .forEach(({ driver, position, isPlayer, classId }: any) => {
      // Filtering: If this class is explicitly hidden, skip drawing
      if (hiddenClasses.has(classId)) return;

      const circleRadius = isPlayer ? playerCircleSize : driverCircleSize;
      
      ctx.fillStyle = isPlayer ? '#00e5ff' : '#ffffff';
      if (driver.classColor) {
        ctx.fillStyle = `#${driver.classColor}`;
      }
      
      // Highlight player with a border
      if (isPlayer) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 8;
          ctx.beginPath();
          ctx.arc(position.x, position.y, circleRadius + 4, 0, 2 * Math.PI);
          ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(position.x, position.y, circleRadius, 0, 2 * Math.PI);
      ctx.fill();

      // Car Number
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = ctx.fillStyle === '#ffffff' ? '#000000' : '#ffffff';
      ctx.font = `bold ${circleRadius * 1.2}px Inter, sans-serif`;
      ctx.fillText(driver.carNum || '', position.x, position.y);
    });
};
