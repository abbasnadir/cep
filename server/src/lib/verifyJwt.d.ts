export default function verifyJwt(token: string): Promise<{
    id: string;
    email: string | undefined;
    role: string | undefined;
}>;
//# sourceMappingURL=verifyJwt.d.ts.map