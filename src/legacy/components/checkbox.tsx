import React from 'react';

interface CheckboxProps {
    checked: boolean;
    handleChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
    name: string;
    label: string;
};

function Checkbox(props: CheckboxProps) {
    return (
        <div className="flex font-mono">
            <input 
                type="checkbox" 
                checked={props.checked} 
                name={props.name}
                onChange={props.handleChange}
            />
            <label htmlFor={props.name} className="ml-2">{props.label}</label>
        </div>
    )
}

export default Checkbox;