import { useState } from "react";
import axiosInstance from "../axiosInstance";
import { Link } from "react-router-dom";

function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();

        setMessage("");
        setError("");

        try {
            const response = await axiosInstance.post("/auth/register", {
                name,
                email,
                password,
            });

            setMessage(response.data.message);
        } catch (err) {
            setError(
                err.response?.data?.detail ||
                err.response?.data?.error ||
                "Registration failed"
            );
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100">
            <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">

                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-bold text-gray-900">
                        GuardTraceAI
                    </h1>

                    <p className="mt-2 text-gray-500">
                        Register Admin Account
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Name
                        </label>

                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Enter your name"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Email
                        </label>

                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                            Password
                        </label>

                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full rounded-lg border border-gray-300 px-4 py-3 outline-none focus:border-blue-500"
                            required
                        />
                    </div>

                    {message && (
                        <p className="text-sm text-green-600">
                            {message}
                        </p>
                    )}

                    {error && (
                        <p className="text-sm text-red-600">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white transition hover:bg-blue-700"
                    >
                        Register Admin
                    </button>
                    <div className="mt-6 text-center">
    <p className="text-sm text-gray-500">
        Already have an account?{" "}
        <Link
            to="/login"
            className="font-medium text-blue-600 hover:text-blue-700"
        >
            Login
        </Link>
    </p>
</div>

                </form>
            </div>
        </div>
    );
}

export default Register;