import MinerScene from "@/features/mining/components/MinerScene";

type HomeScreenProps = {
  miningActive: boolean;
};

export default function HomeScreen({ miningActive }: HomeScreenProps) {
  return (
    <div className="screen home">
      <MinerScene active={miningActive} />
    </div>
  );
}
