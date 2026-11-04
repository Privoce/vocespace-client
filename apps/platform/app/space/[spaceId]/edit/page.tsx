// import SpaceEdit from "../edit";

interface PageProps {
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function SpaceEditPage({ searchParams }: PageProps) {
  const spaceId = searchParams.id as string;
  // return <SpaceEdit spaceId={spaceId} />;
  return <div>Space Edit Page for space ID: {spaceId}</div>;
}