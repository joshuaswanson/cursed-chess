const MUD = `url("${import.meta.env.BASE_URL}textures/trenches/mud.jpg")`;

/** Trenches' backdrop: churned, waterlogged mud as far as the eye can see, the board one stretch of it */
export function MudField() {
  return (
    <div className="mud-field" style={{ backgroundImage: MUD }}>
      <div className="mud-gloom" />
      <div className="mud-smoke mud-smoke-a" />
      <div className="mud-smoke mud-smoke-b" />
    </div>
  );
}
