export function duelActionCall(name: string, duel?: { id: number; stake: string }) {
  if (name === "accept_duel" && !duel) throw new Error("请选择要接受的挑战。");
  return {
    name,
    args: duel ? [duel.id] : [],
    value: name === "accept_duel" ? BigInt(duel!.stake) : 0n,
  };
}

export function contractCall<TAddress, TArgs>(address: TAddress, functionName: string, args: TArgs, value: bigint) {
  return { address, functionName, args, value };
}
